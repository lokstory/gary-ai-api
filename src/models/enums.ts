export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum PaymentProvider {
  STRIPE = 'STRIPE',
}

export enum OrderItemType {
  PROMPT = 'PROMPT',
}

export enum FileCategory {
  COVER = 'COVER',
  MEDIA = 'MEDIA',
  THUMBNAIL = 'THUMBNAIL',
  DOWNLOAD = 'DOWNLOAD',
}

export enum FileType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  PDF = 'PDF',
  ZIP = 'ZIP',
}

export enum MediaType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
}
