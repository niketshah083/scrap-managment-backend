import { Injectable, BadRequestException } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";

export interface UploadedFileInfo {
  originalName: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  size: number;
}

@Injectable()
export class FileUploadService {
  private readonly uploadDir = path.join(process.cwd(), "uploads");

  constructor() {
    // Ensure uploads directory exists
    this.ensureUploadDir();
  }

  private ensureUploadDir(): void {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Save a base64 encoded file to the uploads folder
   */
  async saveBase64File(
    base64Data: string,
    originalName: string,
    tenantId: string,
    transactionId: string,
    fieldName: string
  ): Promise<UploadedFileInfo> {
    // Create tenant/transaction specific folder
    const folderPath = path.join(
      this.uploadDir,
      tenantId,
      transactionId,
      fieldName
    );
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    // Extract mime type and data from base64 string
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new BadRequestException("Invalid base64 data format");
    }

    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], "base64");

    // Generate unique filename
    const ext = this.getExtensionFromMimeType(mimeType);
    const fileName = `${uuidv4()}${ext}`;
    const fullPath = path.join(folderPath, fileName);

    // Write file to disk
    fs.writeFileSync(fullPath, buffer);

    // Return relative path for storage in database
    const relativePath = path.join(
      tenantId,
      transactionId,
      fieldName,
      fileName
    );

    return {
      originalName,
      fileName,
      filePath: `/uploads/${relativePath}`,
      mimeType,
      size: buffer.length,
    };
  }

  /**
   * Save a multipart file upload
   */
  async saveMultipartFile(
    file: Express.Multer.File,
    tenantId: string,
    transactionId: string,
    fieldName: string
  ): Promise<UploadedFileInfo> {
    // Create tenant/transaction specific folder
    const folderPath = path.join(
      this.uploadDir,
      tenantId,
      transactionId,
      fieldName
    );
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    // Generate unique filename
    const ext =
      path.extname(file.originalname) ||
      this.getExtensionFromMimeType(file.mimetype);
    const fileName = `${uuidv4()}${ext}`;
    const fullPath = path.join(folderPath, fileName);

    // Write file to disk
    fs.writeFileSync(fullPath, file.buffer);

    // Return relative path for storage in database
    const relativePath = path.join(
      tenantId,
      transactionId,
      fieldName,
      fileName
    );

    return {
      originalName: file.originalname,
      fileName,
      filePath: `/uploads/${relativePath}`,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  /**
   * Delete a file from uploads folder
   */
  async deleteFile(filePath: string): Promise<boolean> {
    try {
      const fullPath = path.join(process.cwd(), filePath.replace(/^\//, ""));
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/jpg": ".jpg",
      "image/png": ".png",
      "image/gif": ".gif",
      "image/webp": ".webp",
      "application/pdf": ".pdf",
      "application/msword": ".doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        ".docx",
    };
    return mimeToExt[mimeType] || ".bin";
  }
}
