import { ApiProperty } from '@nestjs/swagger';

export class CreatedResponseDto {
  @ApiProperty({ description: 'The unique identifier of the created resource' })
  readonly id!: string;
}
