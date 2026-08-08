import { ApiProperty } from '@nestjs/swagger';

export class ValidationErrorResponseDto {
  @ApiProperty({ type: 'string', example: 'validation' })
  readonly type = 'validation' as const;

  @ApiProperty({ example: 'email must be an email' })
  readonly message!: string;

  @ApiProperty({ example: 'profile.email' })
  readonly field!: string | null;
}
