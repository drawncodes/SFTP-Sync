import upath from './upath';
import { promptForPassword } from '../host';
import logger from '../logger';
import app from '../app';
import { ConnectOption } from './remote-client/remoteClient';
import {
  FileSystem,
  RemoteFileSystem,
  SFTPFileSystem,
  FTPFileSystem,
} from './fs';
import localFs from './localFs';

// Transient connection failures worth an automatic retry (first-connect rejection,
// reset, timeout, broken pipe, or a handshake that dropped before completing).
function isRetryableConnectError(err: any): boolean {
  const code = err && err.code;
  if (code && ['ECONNRESET', 'ETIMEDOUT', 'EPIPE', 'ECONNABORTED'].indexOf(code) !== -1) {
    return true;
  }
  const message = (err && err.message) || '';
  return /ECONNRESET|ETIMEDOUT|EPIPE|before handshake/i.test(message);
}

function hashOption(opiton) {
  return Object.keys(opiton)
    .map(key => opiton[key])
    .join('');
}

class KeepAliveRemoteFs {
  private isValid: boolean = false;

  private pendingPromise: Promise<RemoteFileSystem> | null;

  private fs: RemoteFileSystem;

  async getFs(
    option: ConnectOption & {
      protocol: string;
      remoteTimeOffsetInHours: number;
    }
  ): Promise<RemoteFileSystem> {
    if (this.isValid) {
      this.pendingPromise = null;
      return Promise.resolve(this.fs);
    }

    if (this.pendingPromise) {
      return this.pendingPromise;
    }

    const connectOption = Object.assign({}, option);
    // tslint:disable variable-name
    let FsConstructor: typeof SFTPFileSystem | typeof FTPFileSystem;
    if (option.protocol === 'sftp') {
      connectOption.debug = function debug(str) {
        const log = str.match(/^DEBUG(?:\[SFTP\])?: (.*?): (.*?)$/);

        if (log) {
          if (log[1] === 'Parser') return;
          logger.debug(`${log[1]}: ${log[2]}`);
        } else {
          logger.debug(str);
        }
      };
      FsConstructor = SFTPFileSystem;
    } else if (option.protocol === 'ftp') {
      connectOption.debug = function debug(str) {
        const log = str.match(/^\[connection\] (>|<) (.*?)(\\r\\n)?$/);

        if (!log) return;

        if (log[2].match(/200 NOOP/)) return;

        if (log[2].match(/^PASS /)) log[2] = 'PASS ******';

        logger.debug(`${log[1]} ${log[2]}`);
      };
      FsConstructor = FTPFileSystem;
    } else {
      throw new Error(`unsupported protocol ${option.protocol}`);
    }

    app.sftpBarItem.showMsg('connecting...', connectOption.connectTimeout);
    this.pendingPromise = this._connectWithRetry(FsConstructor, connectOption, option);

    return this.pendingPromise;
  }

  // Some servers reject the first connection on purpose (e.g. a "knock"/first-connect-reject
  // policy) and accept an immediate retry. Reconnects mid-transfer hit the same thing. So we
  // retry transient connection errors a few times with a short backoff before giving up.
  private async _connectWithRetry(
    FsConstructor: typeof SFTPFileSystem | typeof FTPFileSystem,
    connectOption: ConnectOption,
    option: { remoteTimeOffsetInHours: number }
  ): Promise<RemoteFileSystem> {
    const maxAttempts = 4;
    let lastErr: any;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // A fresh fs/client per attempt: a ssh2 Client can't be reused after it errors,
      // and this keeps the onDisconnected binding attached to the live client.
      this.fs = new FsConstructor(upath, {
        clientOption: connectOption,
        remoteTimeOffsetInHours: option.remoteTimeOffsetInHours,
      });
      this.fs.onDisconnected(this.invalid.bind(this));

      try {
        await this.fs.connect(connectOption, { askForPasswd: promptForPassword });
        app.sftpBarItem.reset();
        this.isValid = true;
        return this.fs;
      } catch (err) {
        lastErr = err;
        try {
          this.fs.end();
        } catch {
          // ignore teardown errors on a failed connection
        }

        if (attempt < maxAttempts && isRetryableConnectError(err)) {
          logger.info(
            `connect attempt ${attempt}/${maxAttempts} failed (${err.message}); retrying...`
          );
          await new Promise(resolve => setTimeout(resolve, 250));
          continue;
        }
        break;
      }
    }

    this.invalid('error');
    throw lastErr;
  }

  invalid(reason: string) {
    this.pendingPromise = null;
    this.fs.end();
    this.isValid = false;
  }

  end() {
    this.fs.end();
  }
}

function getLocalFs() {
  return Promise.resolve(localFs);
}

const fsTable: {
  [x: string]: KeepAliveRemoteFs;
} = {};

export function createRemoteIfNoneExist(option): Promise<FileSystem> {
  if (option.protocol === 'local') {
    return getLocalFs();
  }

  const identity = hashOption(option);
  const fs = fsTable[identity];
  if (fs !== undefined) {
    return fs.getFs(option);
  }

  const fsInstance = new KeepAliveRemoteFs();
  fsTable[identity] = fsInstance;
  return fsInstance.getFs(option);
}

export function removeRemoteFs(option) {
  const identity = hashOption(option);
  const fs = fsTable[identity];
  if (fs !== undefined) {
    fs.end();
    delete fsTable[identity];
  }
}
