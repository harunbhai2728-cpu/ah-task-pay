export type UserRole = 'user' | 'admin';

export interface AppNotification {
  id: string;
  message: string;
  createdAt: string;
  isRead: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  username: string;
  phone: string;
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


export type JobStatus = 'open' | 'closed' | 'delete_requested' | 'deleted' | 'rejected' | 'pending';

export interface Job {
  id: string;
  posterId: string;
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
}

export type TransactionType = 'deposit' | 'withdrawal' | 'payment' | 'refund' | 'bonus';
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'rejected' | 'approved';
export type PaymentMethod = 'bKash' | 'Nagad';

export interface Transaction {
  id: string;
  userId: string;
  userSerial?: number | null;
  type: TransactionType;
  amount: number;
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
