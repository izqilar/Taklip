
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.RegionScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name',
  level: 'level',
  regionPath: 'regionPath',
  parentId: 'parentId'
};

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  phone: 'phone',
  wxOpenid: 'wxOpenid',
  password: 'password',
  nickname: 'nickname',
  avatar: 'avatar',
  realName: 'realName',
  idCard: 'idCard',
  realNameStatus: 'realNameStatus',
  realNameVerifiedAt: 'realNameVerifiedAt',
  bio: 'bio',
  email: 'email',
  vipLevel: 'vipLevel',
  locale: 'locale',
  role: 'role',
  lastLoginAt: 'lastLoginAt',
  points: 'points',
  totalSpent: 'totalSpent',
  userBalance: 'userBalance',
  followingProviderCount: 'followingProviderCount',
  serviceRoles: 'serviceRoles',
  pendingServiceRoles: 'pendingServiceRoles',
  providerStatus: 'providerStatus',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  regionId: 'regionId',
  agentId: 'agentId',
  regionPath: 'regionPath',
  status: 'status'
};

exports.Prisma.ProjectScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  title: 'title',
  cover: 'cover',
  status: 'status',
  publishCode: 'publishCode',
  schema: 'schema',
  draftSchema: 'draftSchema',
  version: 'version',
  viewCount: 'viewCount',
  templateId: 'templateId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TemplateScalarFieldEnum = {
  id: 'id',
  name: 'name',
  category: 'category',
  tags: 'tags',
  cover: 'cover',
  schema: 'schema',
  draftSchema: 'draftSchema',
  draftUpdatedAt: 'draftUpdatedAt',
  liveVersion: 'liveVersion',
  isOfficial: 'isOfficial',
  useCount: 'useCount',
  authorId: 'authorId',
  status: 'status',
  reviewNote: 'reviewNote',
  reviewedBy: 'reviewedBy',
  reviewedAt: 'reviewedAt',
  price: 'price',
  currency: 'currency',
  paidFonts: 'paidFonts',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.FontScalarFieldEnum = {
  id: 'id',
  family: 'family',
  displayName: 'displayName',
  files: 'files',
  isPaid: 'isPaid',
  category: 'category',
  sortOrder: 'sortOrder',
  createdAt: 'createdAt'
};

exports.Prisma.ProjectVersionScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  schema: 'schema',
  createdAt: 'createdAt'
};

exports.Prisma.AssetScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  url: 'url',
  type: 'type',
  size: 'size',
  width: 'width',
  height: 'height',
  createdAt: 'createdAt'
};

exports.Prisma.TemplateOrderScalarFieldEnum = {
  id: 'id',
  orderNo: 'orderNo',
  buyerId: 'buyerId',
  templateId: 'templateId',
  amount: 'amount',
  platformFee: 'platformFee',
  designerIncome: 'designerIncome',
  status: 'status',
  serviceStatus: 'serviceStatus',
  createdAt: 'createdAt'
};

exports.Prisma.ProviderWalletScalarFieldEnum = {
  id: 'id',
  providerId: 'providerId',
  balance: 'balance',
  frozen: 'frozen',
  totalIncome: 'totalIncome',
  withdrawn: 'withdrawn',
  updatedAt: 'updatedAt'
};

exports.Prisma.WithdrawalScalarFieldEnum = {
  id: 'id',
  providerId: 'providerId',
  walletId: 'walletId',
  amount: 'amount',
  currency: 'currency',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TemplateAppealScalarFieldEnum = {
  id: 'id',
  templateId: 'templateId',
  providerId: 'providerId',
  reason: 'reason',
  status: 'status',
  adminNote: 'adminNote',
  reviewedBy: 'reviewedBy',
  reviewedAt: 'reviewedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TicketScalarFieldEnum = {
  id: 'id',
  type: 'type',
  title: 'title',
  content: 'content',
  status: 'status',
  regionPath: 'regionPath',
  reporterId: 'reporterId',
  reporterRole: 'reporterRole',
  targetId: 'targetId',
  assigneeId: 'assigneeId',
  assigneeRole: 'assigneeRole',
  escalatedTo: 'escalatedTo',
  escalatedAt: 'escalatedAt',
  resolvedAt: 'resolvedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.MessageScalarFieldEnum = {
  id: 'id',
  type: 'type',
  scope: 'scope',
  title: 'title',
  content: 'content',
  status: 'status',
  authorId: 'authorId',
  authorRole: 'authorRole',
  regionPath: 'regionPath',
  targetRole: 'targetRole',
  approvedBy: 'approvedBy',
  approvedAt: 'approvedAt',
  rejectNote: 'rejectNote',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ReviewScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  orderId: 'orderId',
  providerId: 'providerId',
  rating: 'rating',
  content: 'content',
  reply: 'reply',
  replyRating: 'replyRating',
  replyAt: 'replyAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.MessageReadScalarFieldEnum = {
  id: 'id',
  messageId: 'messageId',
  userId: 'userId',
  readAt: 'readAt'
};

exports.Prisma.QualificationApplicationScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  kind: 'kind',
  status: 'status',
  reason: 'reason',
  serviceScopes: 'serviceScopes',
  regionPath: 'regionPath',
  regionLabel: 'regionLabel',
  applicantName: 'applicantName',
  phone: 'phone',
  certType: 'certType',
  certNo: 'certNo',
  certExpire: 'certExpire',
  certLongTerm: 'certLongTerm',
  issuer: 'issuer',
  attachments: 'attachments',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.WalletLogScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  type: 'type',
  amount: 'amount',
  balanceAfter: 'balanceAfter',
  status: 'status',
  note: 'note',
  createdAt: 'createdAt'
};

exports.Prisma.CouponScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name',
  amount: 'amount',
  benefit: 'benefit',
  minSpend: 'minSpend',
  condition: 'condition',
  tier: 'tier',
  validFrom: 'validFrom',
  validUntil: 'validUntil',
  createdAt: 'createdAt'
};

exports.Prisma.UserCouponScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  couponId: 'couponId',
  status: 'status',
  receivedAt: 'receivedAt',
  usedAt: 'usedAt'
};

exports.Prisma.ProviderScheduleScalarFieldEnum = {
  id: 'id',
  providerId: 'providerId',
  date: 'date',
  period: 'period',
  serviceType: 'serviceType',
  status: 'status',
  orderId: 'orderId',
  customer: 'customer',
  note: 'note',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProviderContractScalarFieldEnum = {
  id: 'id',
  providerId: 'providerId',
  contractNo: 'contractNo',
  type: 'type',
  name: 'name',
  partyA: 'partyA',
  serviceType: 'serviceType',
  businessMode: 'businessMode',
  region: 'region',
  exclusive: 'exclusive',
  platformRate: 'platformRate',
  deposit: 'deposit',
  settlePeriod: 'settlePeriod',
  signStage: 'signStage',
  signDate: 'signDate',
  expireDate: 'expireDate',
  negotiation: 'negotiation',
  attachments: 'attachments',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProviderTeamMemberScalarFieldEnum = {
  id: 'id',
  providerId: 'providerId',
  memberNo: 'memberNo',
  name: 'name',
  phone: 'phone',
  accountStatus: 'accountStatus',
  serviceType: 'serviceType',
  teamRole: 'teamRole',
  duties: 'duties',
  personality: 'personality',
  dataScope: 'dataScope',
  funcPerms: 'funcPerms',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProviderClientScalarFieldEnum = {
  id: 'id',
  providerId: 'providerId',
  clientNo: 'clientNo',
  name: 'name',
  phone: 'phone',
  totalSpend: 'totalSpend',
  lastService: 'lastService',
  tags: 'tags',
  prefs: 'prefs',
  channels: 'channels',
  interactions: 'interactions',
  lastMaintain: 'lastMaintain',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProviderClientReachScalarFieldEnum = {
  id: 'id',
  providerId: 'providerId',
  clientId: 'clientId',
  clientNo: 'clientNo',
  type: 'type',
  channel: 'channel',
  amount: 'amount',
  validTo: 'validTo',
  subject: 'subject',
  content: 'content',
  createdAt: 'createdAt'
};

exports.Prisma.AuditLogScalarFieldEnum = {
  id: 'id',
  actorId: 'actorId',
  actorRole: 'actorRole',
  action: 'action',
  targetType: 'targetType',
  targetId: 'targetId',
  reason: 'reason',
  before: 'before',
  after: 'after',
  createdAt: 'createdAt'
};

exports.Prisma.ProviderLicenseScalarFieldEnum = {
  id: 'id',
  providerId: 'providerId',
  licNo: 'licNo',
  name: 'name',
  type: 'type',
  certNo: 'certNo',
  issuer: 'issuer',
  validFrom: 'validFrom',
  validTo: 'validTo',
  longTerm: 'longTerm',
  expireRemind: 'expireRemind',
  status: 'status',
  description: 'description',
  attachments: 'attachments',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};
exports.RealNameStatus = exports.$Enums.RealNameStatus = {
  UNVERIFIED: 'UNVERIFIED',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
};

exports.Role = exports.$Enums.Role = {
  USER: 'USER',
  SERVICE_PROVIDER: 'SERVICE_PROVIDER',
  AGENT: 'AGENT',
  ADMIN: 'ADMIN'
};

exports.ProviderStatus = exports.$Enums.ProviderStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
};

exports.UserStatus = exports.$Enums.UserStatus = {
  ACTIVE: 'ACTIVE',
  PENDING_RECHECK: 'PENDING_RECHECK',
  DISABLED: 'DISABLED'
};

exports.ServiceRole = exports.$Enums.ServiceRole = {
  DESIGN: 'DESIGN',
  PHOTO: 'PHOTO',
  VENUE: 'VENUE',
  FLORAL: 'FLORAL',
  STEWARD: 'STEWARD',
  PERFORM: 'PERFORM'
};

exports.TemplateStatus = exports.$Enums.TemplateStatus = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  TAKEN_DOWN: 'TAKEN_DOWN'
};

exports.TicketType = exports.$Enums.TicketType = {
  COMPLAINT: 'COMPLAINT',
  PRAISE: 'PRAISE',
  SUGGESTION: 'SUGGESTION',
  CONSULT: 'CONSULT',
  APPEAL: 'APPEAL',
  AFTERSALE: 'AFTERSALE',
  OTHER: 'OTHER'
};

exports.TicketStatus = exports.$Enums.TicketStatus = {
  OPEN: 'OPEN',
  NEGOTIATING: 'NEGOTIATING',
  ESCALATED: 'ESCALATED',
  ARBITRATING: 'ARBITRATING',
  CLOSED: 'CLOSED'
};

exports.MessageType = exports.$Enums.MessageType = {
  ANNOUNCEMENT: 'ANNOUNCEMENT',
  NOTICE: 'NOTICE',
  APPEAL: 'APPEAL'
};

exports.MessageScope = exports.$Enums.MessageScope = {
  GLOBAL: 'GLOBAL',
  REGION: 'REGION',
  OWN: 'OWN'
};

exports.MessageStatus = exports.$Enums.MessageStatus = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  PUBLISHED: 'PUBLISHED',
  REJECTED: 'REJECTED'
};

exports.Prisma.ModelName = {
  Region: 'Region',
  User: 'User',
  Project: 'Project',
  Template: 'Template',
  Font: 'Font',
  ProjectVersion: 'ProjectVersion',
  Asset: 'Asset',
  TemplateOrder: 'TemplateOrder',
  ProviderWallet: 'ProviderWallet',
  Withdrawal: 'Withdrawal',
  TemplateAppeal: 'TemplateAppeal',
  Ticket: 'Ticket',
  Message: 'Message',
  Review: 'Review',
  MessageRead: 'MessageRead',
  QualificationApplication: 'QualificationApplication',
  WalletLog: 'WalletLog',
  Coupon: 'Coupon',
  UserCoupon: 'UserCoupon',
  ProviderSchedule: 'ProviderSchedule',
  ProviderContract: 'ProviderContract',
  ProviderTeamMember: 'ProviderTeamMember',
  ProviderClient: 'ProviderClient',
  ProviderClientReach: 'ProviderClientReach',
  AuditLog: 'AuditLog',
  ProviderLicense: 'ProviderLicense'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
