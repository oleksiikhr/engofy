/* eslint-disable */
export default async () => {
    const t = {};
    return { "@nestjs/swagger": { "models": [[import("./core/validation/validation-error-response.dto.js"), { "ValidationErrorResponseDto": { type: { required: true, type: () => Object, default: "validation" }, message: { required: true, type: () => String }, field: { required: true, type: () => String, nullable: true } } }], [import("./core/http/dto/created-response.dto.js"), { "CreatedResponseDto": { id: { required: true, type: () => String } } }]], "controllers": [[import("./entrypoints/web/internal/controllers/health/health.controller.js"), { "HealthController": { "check": { type: Object } } }]] } };
};