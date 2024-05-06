export interface Config {
  supportedMediaFileTypes: IMediaFileType[];
  localizedEditedSuffixes: string[];
}

export interface IMediaFileType {
  extension: string;
  supportsExif: boolean;
}
