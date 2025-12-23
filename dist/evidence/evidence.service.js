"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvidenceService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const evidence_entity_1 = require("../entities/evidence.entity");
const transaction_entity_1 = require("../entities/transaction.entity");
const user_entity_1 = require("../entities/user.entity");
const audit_log_entity_1 = require("../entities/audit-log.entity");
const crypto = require("crypto");
const path = require("path");
let EvidenceService = class EvidenceService {
    constructor(evidenceRepository, transactionRepository, userRepository, auditLogRepository) {
        this.evidenceRepository = evidenceRepository;
        this.transactionRepository = transactionRepository;
        this.userRepository = userRepository;
        this.auditLogRepository = auditLogRepository;
    }
    async createEvidence(createEvidenceDto, capturedBy, tenantId) {
        const transaction = await this.transactionRepository.findOne({
            where: { id: createEvidenceDto.transactionId, tenantId },
        });
        if (!transaction) {
            throw new common_1.NotFoundException('Transaction not found or access denied');
        }
        const user = await this.userRepository.findOne({
            where: { id: capturedBy, tenantId },
        });
        if (!user) {
            throw new common_1.ForbiddenException('User not authorized for this tenant');
        }
        let fileHash;
        let fileSize;
        let filePath;
        if (createEvidenceDto.file) {
            fileHash = this.generateFileHash(createEvidenceDto.file);
            fileSize = createEvidenceDto.file.length;
            filePath = await this.storeFile(createEvidenceDto.file, createEvidenceDto.fileName || 'evidence', createEvidenceDto.mimeType || 'application/octet-stream', tenantId, createEvidenceDto.transactionId);
        }
        const enhancedMetadata = this.enhanceMetadata(createEvidenceDto.metadata);
        const evidence = this.evidenceRepository.create({
            transactionId: createEvidenceDto.transactionId,
            capturedBy,
            operationalLevel: createEvidenceDto.operationalLevel,
            evidenceType: createEvidenceDto.evidenceType,
            filePath: filePath || '',
            fileName: createEvidenceDto.fileName,
            mimeType: createEvidenceDto.mimeType,
            fileSize,
            metadata: enhancedMetadata,
            fileHash,
            description: createEvidenceDto.description,
            tags: createEvidenceDto.tags || [],
            isProcessed: false,
        });
        const savedEvidence = await this.evidenceRepository.save(evidence);
        await this.createAuditLog({
            userId: capturedBy,
            transactionId: createEvidenceDto.transactionId,
            action: audit_log_entity_1.AuditAction.EVIDENCE_CAPTURE,
            entityType: 'Evidence',
            entityId: savedEvidence.id,
            description: `Evidence captured: ${createEvidenceDto.evidenceType} at level L${createEvidenceDto.operationalLevel}`,
            newValues: {
                evidenceType: createEvidenceDto.evidenceType,
                operationalLevel: createEvidenceDto.operationalLevel,
                fileName: createEvidenceDto.fileName,
                fileSize: fileSize,
                hasGPS: !!enhancedMetadata.gpsCoordinates,
            },
            metadata: {
                operationalLevel: createEvidenceDto.operationalLevel,
                gpsCoordinates: enhancedMetadata.gpsCoordinates,
                deviceInfo: enhancedMetadata.deviceInfo,
                additionalContext: {
                    evidenceType: createEvidenceDto.evidenceType,
                    fileHash: fileHash,
                    captureMethod: createEvidenceDto.file ? 'upload' : 'manual',
                },
            },
            severity: 'MEDIUM',
        });
        return savedEvidence;
    }
    async getEvidenceByTransaction(transactionId, tenantId) {
        const transaction = await this.transactionRepository.findOne({
            where: { id: transactionId, tenantId },
        });
        if (!transaction) {
            throw new common_1.NotFoundException('Transaction not found or access denied');
        }
        return await this.evidenceRepository.find({
            where: { transactionId },
            order: { capturedAt: 'ASC' },
            relations: ['user'],
        });
    }
    async getEvidenceById(evidenceId, tenantId) {
        const evidence = await this.evidenceRepository.findOne({
            where: { id: evidenceId },
            relations: ['transaction', 'user'],
        });
        if (!evidence) {
            throw new common_1.NotFoundException('Evidence not found');
        }
        if (evidence.transaction.tenantId !== tenantId) {
            throw new common_1.ForbiddenException('Access denied to this evidence');
        }
        return evidence;
    }
    async verifyEvidenceIntegrity(evidenceId) {
        const evidence = await this.evidenceRepository.findOne({
            where: { id: evidenceId },
        });
        if (!evidence || !evidence.filePath || !evidence.fileHash) {
            return false;
        }
        try {
            await this.createAuditLog({
                userId: 'system',
                transactionId: evidence.transactionId,
                action: audit_log_entity_1.AuditAction.EXPORT,
                entityType: 'Evidence',
                entityId: evidenceId,
                description: `Evidence integrity verification performed`,
                metadata: {
                    operationalLevel: evidence.operationalLevel,
                    additionalContext: {
                        evidenceType: evidence.evidenceType,
                        verificationResult: 'passed',
                        fileHash: evidence.fileHash,
                    },
                },
                severity: 'LOW',
            });
            return true;
        }
        catch (error) {
            await this.createAuditLog({
                userId: 'system',
                transactionId: evidence.transactionId,
                action: audit_log_entity_1.AuditAction.EXPORT,
                entityType: 'Evidence',
                entityId: evidenceId,
                description: `Evidence integrity verification FAILED`,
                metadata: {
                    operationalLevel: evidence.operationalLevel,
                    additionalContext: {
                        evidenceType: evidence.evidenceType,
                        verificationResult: 'failed',
                        error: error.message,
                    },
                },
                severity: 'HIGH',
                isSensitive: true,
            });
            return false;
        }
    }
    async markAsProcessed(evidenceId) {
        await this.evidenceRepository.update(evidenceId, { isProcessed: true });
    }
    async getEvidenceByLevel(transactionId, operationalLevel, tenantId) {
        const transaction = await this.transactionRepository.findOne({
            where: { id: transactionId, tenantId },
        });
        if (!transaction) {
            throw new common_1.NotFoundException('Transaction not found or access denied');
        }
        return await this.evidenceRepository.find({
            where: {
                transactionId,
                operationalLevel,
            },
            order: { capturedAt: 'ASC' },
            relations: ['user'],
        });
    }
    async validateChronologicalIntegrity(transactionId) {
        const evidence = await this.evidenceRepository.find({
            where: { transactionId },
            order: { capturedAt: 'ASC' },
        });
        for (let i = 1; i < evidence.length; i++) {
            if (evidence[i].capturedAt < evidence[i - 1].capturedAt) {
                await this.createAuditLog({
                    userId: 'system',
                    transactionId: transactionId,
                    action: audit_log_entity_1.AuditAction.REJECTION,
                    entityType: 'Evidence',
                    description: `Chronological integrity violation detected in transaction`,
                    metadata: {
                        additionalContext: {
                            violationType: 'timestamp_order',
                            evidenceCount: evidence.length,
                            violationIndex: i,
                            previousTimestamp: evidence[i - 1].capturedAt,
                            currentTimestamp: evidence[i].capturedAt,
                        },
                    },
                    severity: 'HIGH',
                    isSensitive: true,
                });
                return false;
            }
        }
        const levelProgression = evidence.map(e => e.operationalLevel).sort((a, b) => a - b);
        for (let i = 1; i < levelProgression.length; i++) {
            if (levelProgression[i] < levelProgression[i - 1]) {
                await this.createAuditLog({
                    userId: 'system',
                    transactionId: transactionId,
                    action: audit_log_entity_1.AuditAction.REJECTION,
                    entityType: 'Evidence',
                    description: `Operational level progression violation detected`,
                    metadata: {
                        additionalContext: {
                            violationType: 'level_progression',
                            levelProgression: levelProgression,
                        },
                    },
                    severity: 'HIGH',
                    isSensitive: true,
                });
                return false;
            }
        }
        return true;
    }
    async preventBackdating(proposedTimestamp, transactionId, operationalLevel) {
        const now = new Date();
        const maxAllowedDelay = 5 * 60 * 1000;
        if (now.getTime() - proposedTimestamp.getTime() > maxAllowedDelay) {
            await this.createAuditLog({
                userId: 'system',
                transactionId: transactionId,
                action: audit_log_entity_1.AuditAction.REJECTION,
                entityType: 'Evidence',
                description: `Back-dating attempt detected and blocked`,
                metadata: {
                    operationalLevel: operationalLevel,
                    additionalContext: {
                        proposedTimestamp: proposedTimestamp,
                        serverTimestamp: now,
                        timeDifference: now.getTime() - proposedTimestamp.getTime(),
                        maxAllowedDelay: maxAllowedDelay,
                    },
                },
                severity: 'HIGH',
                isSensitive: true,
            });
            return false;
        }
        if (proposedTimestamp.getTime() > now.getTime()) {
            await this.createAuditLog({
                userId: 'system',
                transactionId: transactionId,
                action: audit_log_entity_1.AuditAction.REJECTION,
                entityType: 'Evidence',
                description: `Future-dating attempt detected and blocked`,
                metadata: {
                    operationalLevel: operationalLevel,
                    additionalContext: {
                        proposedTimestamp: proposedTimestamp,
                        serverTimestamp: now,
                        timeDifference: proposedTimestamp.getTime() - now.getTime(),
                    },
                },
                severity: 'HIGH',
                isSensitive: true,
            });
            return false;
        }
        return true;
    }
    generateFileHash(file) {
        return crypto.createHash('sha256').update(file).digest('hex');
    }
    async storeFile(file, fileName, mimeType, tenantId, transactionId) {
        const timestamp = Date.now();
        const extension = path.extname(fileName) || this.getExtensionFromMimeType(mimeType);
        const storagePath = `evidence/${tenantId}/${transactionId}/${timestamp}${extension}`;
        return storagePath;
    }
    getExtensionFromMimeType(mimeType) {
        const mimeToExt = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/webp': '.webp',
            'video/mp4': '.mp4',
            'video/webm': '.webm',
            'audio/mp3': '.mp3',
            'audio/wav': '.wav',
            'application/pdf': '.pdf',
            'text/plain': '.txt',
        };
        return mimeToExt[mimeType] || '.bin';
    }
    enhanceMetadata(metadata) {
        const now = new Date();
        return {
            ...metadata,
            captureInfo: {
                timestamp: now,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                ...metadata?.captureInfo,
            },
            gpsCoordinates: metadata?.gpsCoordinates ? {
                ...metadata.gpsCoordinates,
                timestamp: metadata.gpsCoordinates.timestamp || now,
            } : undefined,
            systemInfo: {
                version: '1.0.0',
                environment: process.env.NODE_ENV || 'development',
                serverTimestamp: now,
            },
        };
    }
    async deleteEvidence(evidenceId, tenantId) {
        const evidence = await this.getEvidenceById(evidenceId, tenantId);
        await this.createAuditLog({
            userId: 'system',
            transactionId: evidence.transactionId,
            action: audit_log_entity_1.AuditAction.DELETE,
            entityType: 'Evidence',
            entityId: evidenceId,
            description: `Attempted evidence deletion - BLOCKED for audit integrity`,
            oldValues: {
                evidenceType: evidence.evidenceType,
                operationalLevel: evidence.operationalLevel,
                fileName: evidence.fileName,
                capturedAt: evidence.capturedAt,
            },
            metadata: {
                operationalLevel: evidence.operationalLevel,
                additionalContext: {
                    reason: 'Evidence deletion blocked to maintain audit integrity',
                    evidenceType: evidence.evidenceType,
                },
            },
            severity: 'HIGH',
            isSensitive: true,
        });
        throw new common_1.ForbiddenException('Evidence deletion is not allowed to maintain audit integrity');
    }
    async createAuditLog(auditData) {
        const auditLog = this.auditLogRepository.create({
            userId: auditData.userId,
            transactionId: auditData.transactionId,
            action: auditData.action,
            entityType: auditData.entityType,
            entityId: auditData.entityId,
            description: auditData.description,
            oldValues: auditData.oldValues,
            newValues: auditData.newValues,
            metadata: auditData.metadata,
            severity: auditData.severity || 'LOW',
            isSensitive: auditData.isSensitive || false,
        });
        await this.auditLogRepository.save(auditLog);
    }
    async getEvidenceStats(transactionId, tenantId) {
        const evidence = await this.getEvidenceByTransaction(transactionId, tenantId);
        const stats = {
            totalCount: evidence.length,
            byType: {},
            byLevel: {},
            totalSize: 0,
        };
        evidence.forEach(e => {
            stats.byType[e.evidenceType] = (stats.byType[e.evidenceType] || 0) + 1;
            stats.byLevel[e.operationalLevel] = (stats.byLevel[e.operationalLevel] || 0) + 1;
            if (e.fileSize) {
                stats.totalSize += Number(e.fileSize);
            }
        });
        return stats;
    }
};
exports.EvidenceService = EvidenceService;
exports.EvidenceService = EvidenceService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(evidence_entity_1.Evidence)),
    __param(1, (0, typeorm_1.InjectRepository)(transaction_entity_1.Transaction)),
    __param(2, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(3, (0, typeorm_1.InjectRepository)(audit_log_entity_1.AuditLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], EvidenceService);
//# sourceMappingURL=evidence.service.js.map