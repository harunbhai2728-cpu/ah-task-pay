export type UserRole = 'user' | 'admin';

export interface AppNotification {
  id: string;
  message: string;
  type?: 'approved' | 'rejected' | 'info' | 'warning';
  createdAt: string;
  isRead: boolean;
}

export interface UserProfile {
  uid: string;
  id?: string;
  email: string;
  displayName: string;
  username: string;
  phone: string;
  phoneNumber?: string;
  role: UserRole;
  earningBalance: number;
  depositBalance: number;
  heldBalance: number;
  pendingEarningBalance?: number;
  pendingDepositBalance?: number;
  serialNumber: number;
  isBlocked?: boolean;
  warning?: string;
  warningCount?: number;
  notifications?: AppNotification[];
  last_ip_address?: string | null;
  device_fingerprint?: string | null;
  account_status?: 'active' | 'pending_deletion' | 'deleted';
  deletion_reason?: string | null;
  deleted_by?: 'user' | 'admin' | null;
  createdAt: any;
}


export type JobStatus = 'open' | 'closed' | 'delete_requested' | 'deleted' | 'rejected' | 'pending' | 'completed';

export interface Job {
  id: string;
  posterId: string;
  author_id?: string;
  posterName?: string;
  posterSerial?: number;
  title: string;
  thumbnail?: string;
  description: string;
  screenshotCount: number;
  requireTextProof: boolean;
  autoApprove: boolean;
  pinCode?: string;
  pricePerWork: number;
  reward?: number;
  maxWorkers: number;
  completedCount: number;
  pendingCount?: number;
  approvedCount?: number;
  isFull?: boolean;
  status: JobStatus;
  createdAt: any;
  textProofInstruction?: string;
  screenshotProofInstructions?: string[];
  screenshotProofInstruction?: string; // legacy
  category?: string;
  mainCategory?: string;
  subCategory?: string;
  targetCountry?: string;
  durationDays?: number;
  expiresAt?: string;
}

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface Submission {
  id: string;
  jobId: string;
  jobTitle?: string;
  workerId: string;
  workerName?: string;
  workerSerial?: number | null;
  posterId: string;
  proofText?: string;
  screenshots: string[];
  status: SubmissionStatus;
  rejectionReason?: string;
  submittedAt: any;
  reviewedAt?: any;
  reward: number;
  imageDeleted?: boolean;
}

export type TransactionType = 'deposit' | 'withdrawal' | 'payment' | 'refund' | 'bonus';
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'rejected' | 'approved';
export type PaymentMethod = 'bKash' | 'Nagad' | 'Recharge' | 'Mobile Recharge';

export interface Transaction {
  id: string;
  userId: string;
  userSerial?: number | null;
  type: TransactionType;
  amount: number;
  fee?: number;
  finalAmount?: number;
  method?: PaymentMethod;
  phone?: string;
  transactionId?: string;
  status: TransactionStatus;
  createdAt: any;
}

export type TicketStatus = 'open' | 'resolved';

export interface Ticket {
  id: string;
  userId: string;
  userSerial?: number | null;
  subject: string;
  status: TicketStatus;
  createdAt: any;
  resolvedAt?: any;
  adminReply?: string;
  replies?: {
    sender: 'user' | 'admin';
    text: string;
    createdAt?: any;
  }[];
  relatedJobId?: string;
}
