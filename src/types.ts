export interface SpreadsheetFile {
  id: string;
  name: string;
  modifiedTime?: string;
}

export interface Worksheet {
  title: string;
  index: number;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  details?: string;
}

export interface HubItem {
  id: string;
  title: string;
  category: string;
  description: string;
  detailedDescription?: string;
  views: string;
  downloads: string;
  fileSize: string;
  imageUrl: string;
  downloadUrl: string;
  rating: string;
  type?: string;
  subCategory?: string;
}
