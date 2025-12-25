import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from "@nestjs/swagger";
import { FileUploadService, UploadedFileInfo } from "./file-upload.service";

interface Base64UploadDto {
  base64Data: string;
  originalName: string;
  tenantId: string;
  transactionId: string;
  fieldName: string;
}

interface MultipleBase64UploadDto {
  files: {
    base64Data: string;
    originalName: string;
  }[];
  tenantId: string;
  transactionId: string;
  fieldName: string;
}

@ApiTags("File Upload")
@Controller("files")
export class FileUploadController {
  constructor(private readonly fileUploadService: FileUploadService) {}

  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  @ApiOperation({ summary: "Upload a single file" })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({ status: 201, description: "File uploaded successfully" })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body("tenantId") tenantId: string,
    @Body("transactionId") transactionId: string,
    @Body("fieldName") fieldName: string
  ): Promise<UploadedFileInfo> {
    if (!file) {
      throw new BadRequestException("No file provided");
    }
    if (!tenantId || !transactionId || !fieldName) {
      throw new BadRequestException(
        "tenantId, transactionId, and fieldName are required"
      );
    }

    return this.fileUploadService.saveMultipartFile(
      file,
      tenantId,
      transactionId,
      fieldName
    );
  }

  @Post("upload-multiple")
  @UseInterceptors(FilesInterceptor("files", 10))
  @ApiOperation({ summary: "Upload multiple files" })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({ status: 201, description: "Files uploaded successfully" })
  async uploadMultipleFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Body("tenantId") tenantId: string,
    @Body("transactionId") transactionId: string,
    @Body("fieldName") fieldName: string
  ): Promise<UploadedFileInfo[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException("No files provided");
    }
    if (!tenantId || !transactionId || !fieldName) {
      throw new BadRequestException(
        "tenantId, transactionId, and fieldName are required"
      );
    }

    const results: UploadedFileInfo[] = [];
    for (const file of files) {
      const result = await this.fileUploadService.saveMultipartFile(
        file,
        tenantId,
        transactionId,
        fieldName
      );
      results.push(result);
    }
    return results;
  }

  @Post("upload-base64")
  @ApiOperation({ summary: "Upload a file as base64" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        base64Data: { type: "string", description: "Base64 encoded file data" },
        originalName: { type: "string", description: "Original file name" },
        tenantId: { type: "string" },
        transactionId: { type: "string" },
        fieldName: { type: "string" },
      },
    },
  })
  @ApiResponse({ status: 201, description: "File uploaded successfully" })
  async uploadBase64(@Body() dto: Base64UploadDto): Promise<UploadedFileInfo> {
    if (!dto.base64Data || !dto.originalName) {
      throw new BadRequestException("base64Data and originalName are required");
    }
    if (!dto.tenantId || !dto.transactionId || !dto.fieldName) {
      throw new BadRequestException(
        "tenantId, transactionId, and fieldName are required"
      );
    }

    return this.fileUploadService.saveBase64File(
      dto.base64Data,
      dto.originalName,
      dto.tenantId,
      dto.transactionId,
      dto.fieldName
    );
  }

  @Post("upload-base64-multiple")
  @ApiOperation({ summary: "Upload multiple files as base64" })
  @ApiResponse({ status: 201, description: "Files uploaded successfully" })
  async uploadMultipleBase64(
    @Body() dto: MultipleBase64UploadDto
  ): Promise<UploadedFileInfo[]> {
    if (!dto.files || dto.files.length === 0) {
      throw new BadRequestException("No files provided");
    }
    if (!dto.tenantId || !dto.transactionId || !dto.fieldName) {
      throw new BadRequestException(
        "tenantId, transactionId, and fieldName are required"
      );
    }

    const results: UploadedFileInfo[] = [];
    for (const file of dto.files) {
      const result = await this.fileUploadService.saveBase64File(
        file.base64Data,
        file.originalName,
        dto.tenantId,
        dto.transactionId,
        dto.fieldName
      );
      results.push(result);
    }
    return results;
  }
}
