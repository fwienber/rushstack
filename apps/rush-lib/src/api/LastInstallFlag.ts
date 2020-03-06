import * as path from 'path';
import * as _ from 'lodash';
import { FileSystem, JsonFile, JsonObject } from '@microsoft/node-core-library';
import { PackageManagerName } from './packageManager/PackageManager'

export const LAST_INSTALL_FLAG_FILE_NAME: string = 'last-install.flag';

interface ILastInstallFlagErrorState {
  oldState: JsonObject;
  newState: JsonObject;
}

/**
 * Defines an `Error` of type `LastInstallFlagError` that can be generated by `LastInstallFlag`
 * when it is needed.
 * @internal
 */
export class LastInstallFlagError extends Error {
  /**
   * Creates a new LastInstallFlagError
   * @param errorKey - The error to generate
   * @param state - Object containing the old and new LastInstallFlag state
   */
  public constructor(errorKey: string, state: ILastInstallFlagErrorState) {
    super();

    const { oldState, newState } = state;

    switch (errorKey) {
      case 'storePath': {
        const oldStorePath: string = oldState.storePath || '<global>';
        const newStorePath: string = newState.storePath || '<global>';
        this.message = 
          "Current PNPM store path does not match the last one used.  This may cause inconsistency in your builds.\n\n" +
          "If you wish to install with the new store path, please run \"rush update --purge\"\n\n" +
          `Old Path: ${oldStorePath}\n` +
          `New Path: ${newStorePath}`
        break;
      }
      default: {
        // the `errorKey` didn't have an error key defined.  Throw an Error
        // so the developer knows.
        throw new Error(`LastInstallFlagError: an invalid 'errorKey' was defined\nThe key '${errorKey}' does not have an error message defined`);
        break;
      }
    }
  }


}

/**
 * A helper class for managing last-install flags, which are persistent and
 * indicate that something installed in the folder was sucessfully completed.
 * It also compares state, so that if something like the Node.js version has changed,
 * it can invalidate the last install.
 * @internal
 */
export class LastInstallFlag {
  private _path: string;
  private _state: JsonObject;

  /**
   * Creates a new LastInstall flag
   * @param folderPath - the folder that this flag is managing
   * @param state - optional, the state that should be managed or compared
  */
  public constructor(folderPath: string, state: JsonObject = {}) {
    this._path = path.join(folderPath, LAST_INSTALL_FLAG_FILE_NAME);
    this._state = state;
  }

  /**
   * Returns true if the file exists and the contents match the current state
   * @param abortOnInvalid - If the current state is not equal to the previous
   * state, and an the current state causes an error, then throw an exception
   * with a friendly message
   */
  public isValid(abortOnInvalid: boolean = false): boolean {
    if (!FileSystem.exists(this._path)) {
      return false;
    }
    let contents: JsonObject;
    try {
      contents = JsonFile.load(this._path);
    } catch (err) {
      return false;
    } 
    if (!_.isEqual(contents, this._state)) {
      if (abortOnInvalid) {
        const flagError: LastInstallFlagError | void = this._stateHasError(contents);
        if (flagError) {
          throw flagError;
        }
      }
      return false;
    }
    return true;
  }

  /**
   * Determine if the new LastInstallFlag state should generate an error
   * @param {JsonObject} oldState The LastInstallFlag contents read from the disk
   */
  private _stateHasError(oldState: JsonObject): LastInstallFlagError | void {
    const pkgManager: PackageManagerName = this._state.packageManager;
    switch (pkgManager) {
      case 'pnpm': {
        if (
          ( // Only throw an error if the package manager hasn't changed from pnpm
            oldState.packageManager === pkgManager
          ) && ( // Throw if the store path changed
            oldState.storePath &&
            oldState.storePath !== this._state.storePath
          )
        ) {
          return new LastInstallFlagError('storePath', {
            newState: this._state,
            oldState,
          });
        }
        break;
      }
    }
  }

  /**
   * Writes the flag file to disk with the current state
   */
  public create(): void {
    JsonFile.save(this._state, this._path, {
      ensureFolderExists: true
    });
  }

  /**
   * Removes the flag file
   */
  public clear(): void {
    FileSystem.deleteFile(this._path);
  }

  /**
   * Returns the full path to the flag file
   */
  public get path(): string {
    return this._path;
  }
}