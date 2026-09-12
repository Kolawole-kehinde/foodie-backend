export type CreateMediaUploadResponseDto = {
  uploadId: string;
  objectKey: string;
  url: string;
  fields: Record<string, string>;
  maxFileSize: number;
  contentType: string;
};

export type ConfirmMediaUploadResponseDto = {
  id: string;
  objectKey: string;
  type: string;
  status: "READY";
  fileSize: number;
};