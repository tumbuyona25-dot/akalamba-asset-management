import { Timestamp } from 'firebase/firestore';

export enum UserRank {
  BASIC = "Basic",
  BRONZE = "Bronze Leader",
  SILVER = "Silver Leader",
  GOLD = "Gold Leader",
  PLATINUM = "Platinum Leader"
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  referralCode: string;
  referrerId?: string;
  mt5Login: string;
  investorPassword?: string;
  balance: number;
  totalProfit: number;
  teamVolume: number;
  rank: UserRank;
  createdAt: Timestamp;
}

export interface ProfitEntry {
  id: string;
  userId: string;
  amount: number;
  companyFee: number;
  distributed: boolean;
  createdAt: Timestamp;
}

export interface Commission {
  id: string;
  userId: string;
  sourceUserId: string;
  profitId: string;
  amount: number;
  level: number;
  createdAt: Timestamp;
}

export interface Withdrawal {
  id: string;
  userId: string;
  amount: number;
  address: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp;
  processedAt?: Timestamp;
}

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  createdAt: Timestamp;
}

export interface SystemSettings {
  ibLink: string;
  supportLink: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}
