import {
  ApiDocumentedItem,
  ApiItem,
  ApiModel,
  IResolveDeclarationReferenceResult
} from '@microsoft/api-extractor-model';
import { FileSystem } from '@rushstack/node-core-library';
import path from 'path';
import * as tsdoc from '@microsoft/tsdoc';
import colors from 'colors';
import { IBuildApiModelResult } from '../cli/BaseAction';
import { MarkdownDocumenter } from '../documenters/MarkdownDocumenter';

export interface IApiDocumenterAccessOptions {
  _inputFolderParameter: string;
  _outputFolderParameter: string;
}

export class ApiDocumenterAccess {
  public generateFiles(accessOptions: IApiDocumenterAccessOptions): void {
    const { apiModel, outputFolder } = this.buildApiModel(accessOptions);

    const markdownDocumenter: MarkdownDocumenter = new MarkdownDocumenter({
      apiModel,
      documenterConfig: undefined,
      outputFolder
    });
    markdownDocumenter.generateFiles();
  }

  protected buildApiModel(accessOptions: IApiDocumenterAccessOptions): IBuildApiModelResult {
    const apiModel: ApiModel = new ApiModel();

    const inputFolder: string = accessOptions._inputFolderParameter || './input';
    if (!FileSystem.exists(inputFolder)) {
      throw new Error('The input folder does not exist: ' + inputFolder);
    }

    const outputFolder: string = accessOptions._outputFolderParameter || `./ApiDocumenter`;
    FileSystem.ensureFolder(outputFolder);

    for (const filename of FileSystem.readFolderItemNames(inputFolder)) {
      if (filename.match(/\.api\.json$/i)) {
        console.log(`Reading ${filename}`);
        const filenamePath: string = path.join(inputFolder, filename);
        apiModel.loadPackage(filenamePath);
      }
    }

    this._applyInheritDoc(apiModel, apiModel);

    return { apiModel, inputFolder, outputFolder };
  }

  // TODO: This is a temporary workaround.  The long term plan is for API Extractor's DocCommentEnhancer
  // to apply all @inheritDoc tags before the .api.json file is written.
  // See DocCommentEnhancer._applyInheritDoc() for more info.
  private _applyInheritDoc(apiItem: ApiItem, apiModel: ApiModel): void {
    if (apiItem instanceof ApiDocumentedItem) {
      if (apiItem.tsdocComment) {
        const inheritDocTag: tsdoc.DocInheritDocTag | undefined = apiItem.tsdocComment.inheritDocTag;

        if (inheritDocTag && inheritDocTag.declarationReference) {
          // Attempt to resolve the declaration reference
          const result: IResolveDeclarationReferenceResult = apiModel.resolveDeclarationReference(
            inheritDocTag.declarationReference,
            apiItem
          );

          if (result.errorMessage) {
            console.log(
              colors.yellow(
                `Warning: Unresolved @inheritDoc tag for ${apiItem.displayName}: ` + result.errorMessage
              )
            );
          } else {
            if (
              result.resolvedApiItem instanceof ApiDocumentedItem &&
              result.resolvedApiItem.tsdocComment &&
              result.resolvedApiItem !== apiItem
            ) {
              this._copyInheritedDocs(apiItem.tsdocComment, result.resolvedApiItem.tsdocComment);
            }
          }
        }
      }
    }
  }

  /**
   * Copy the content from `sourceDocComment` to `targetDocComment`.
   * This code is borrowed from DocCommentEnhancer as a temporary workaround.
   */
  private _copyInheritedDocs(targetDocComment: tsdoc.DocComment, sourceDocComment: tsdoc.DocComment): void {
    targetDocComment.summarySection = sourceDocComment.summarySection;
    targetDocComment.remarksBlock = sourceDocComment.remarksBlock;

    targetDocComment.params.clear();
    for (const param of sourceDocComment.params) {
      targetDocComment.params.add(param);
    }
    for (const typeParam of sourceDocComment.typeParams) {
      targetDocComment.typeParams.add(typeParam);
    }
    targetDocComment.returnsBlock = sourceDocComment.returnsBlock;

    targetDocComment.inheritDocTag = undefined;
  }
}
