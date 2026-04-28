-- Baseline SQL Server migration.
-- Replaces all previous MySQL-syntax migrations with correct T-SQL.
-- Covers every model in schema.prisma except WalletCustomerActivitySnapshot
-- (20260426000100) and the emailer-service tables (20260428080000), which
-- are handled by their own already-correct SQL Server migrations.

-- ── User ─────────────────────────────────────────────────────────────────────

CREATE TABLE [User] (
    [id]           BIGINT       NOT NULL IDENTITY(1,1),
    [username]     VARCHAR(80)  NOT NULL,
    [role]         VARCHAR(20)  NOT NULL CONSTRAINT [User_role_df]      DEFAULT 'VIEWER',
    [isActive]     BIT          NOT NULL CONSTRAINT [User_isActive_df]  DEFAULT 1,
    [createdAt]    DATETIME2    NOT NULL CONSTRAINT [User_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt]    DATETIME2    NOT NULL,
    CONSTRAINT [User_pkey]         PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [User_username_key] UNIQUE NONCLUSTERED ([username])
);

-- ── Branch ───────────────────────────────────────────────────────────────────

CREATE TABLE [Branch] (
    [id]        BIGINT        NOT NULL IDENTITY(1,1),
    [city]      VARCHAR(80)   NOT NULL,
    [label]     VARCHAR(80)   NOT NULL,
    [address]   VARCHAR(255)  NULL,
    [isActive]  BIT           NOT NULL CONSTRAINT [Branch_isActive_df]  DEFAULT 1,
    [createdAt] DATETIME2     NOT NULL CONSTRAINT [Branch_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2     NOT NULL,
    CONSTRAINT [Branch_pkey]           PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Branch_city_label_key] UNIQUE NONCLUSTERED ([city], [label])
);

CREATE INDEX [Branch_city_idx]  ON [Branch]([city]);
CREATE INDEX [Branch_label_idx] ON [Branch]([label]);

-- ── BranchAgentLine ──────────────────────────────────────────────────────────

CREATE TABLE [BranchAgentLine] (
    [id]         BIGINT      NOT NULL IDENTITY(1,1),
    [branchId]   BIGINT      NOT NULL,
    [lineNumber] VARCHAR(60) NOT NULL,
    [isActive]   BIT         NOT NULL CONSTRAINT [BranchAgentLine_isActive_df]  DEFAULT 1,
    [createdAt]  DATETIME2   NOT NULL CONSTRAINT [BranchAgentLine_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt]  DATETIME2   NOT NULL,
    CONSTRAINT [BranchAgentLine_pkey]          PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [uq_branch_line_number]         UNIQUE NONCLUSTERED ([branchId], [lineNumber])
);

CREATE INDEX [BranchAgentLine_lineNumber_idx]       ON [BranchAgentLine]([lineNumber]);
CREATE INDEX [BranchAgentLine_branchId_isActive_idx] ON [BranchAgentLine]([branchId], [isActive]);

-- ── ReminderRecipient ────────────────────────────────────────────────────────

CREATE TABLE [ReminderRecipient] (
    [id]        BIGINT        NOT NULL IDENTITY(1,1),
    [email]     VARCHAR(190)  NOT NULL,
    [name]      VARCHAR(120)  NULL,
    [isActive]  BIT           NOT NULL CONSTRAINT [ReminderRecipient_isActive_df]  DEFAULT 1,
    [createdAt] DATETIME2     NOT NULL CONSTRAINT [ReminderRecipient_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2     NOT NULL,
    CONSTRAINT [ReminderRecipient_pkey]             PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [uq_reminder_recipient_email]        UNIQUE NONCLUSTERED ([email])
);

CREATE INDEX [ReminderRecipient_email_idx]    ON [ReminderRecipient]([email]);
CREATE INDEX [ReminderRecipient_isActive_idx] ON [ReminderRecipient]([isActive]);

-- ── BranchMetric ─────────────────────────────────────────────────────────────

CREATE TABLE [BranchMetric] (
    [id]                     BIGINT        NOT NULL IDENTITY(1,1),
    [branchId]               BIGINT        NOT NULL,
    [metricDate]             DATE          NOT NULL,
    [eFloatBalance]          DECIMAL(18,2) NOT NULL CONSTRAINT [BranchMetric_eFloatBalance_df]          DEFAULT 0.00,
    [cashInVolume]           INT           NOT NULL CONSTRAINT [BranchMetric_cashInVolume_df]           DEFAULT 0,
    [cashInValue]            DECIMAL(18,2) NOT NULL CONSTRAINT [BranchMetric_cashInValue_df]            DEFAULT 0.00,
    [cashOutVolume]          INT           NOT NULL CONSTRAINT [BranchMetric_cashOutVolume_df]          DEFAULT 0,
    [cashOutValue]           DECIMAL(18,2) NOT NULL CONSTRAINT [BranchMetric_cashOutValue_df]           DEFAULT 0.00,
    [totalTransactionVolume] INT           NOT NULL CONSTRAINT [BranchMetric_totalTransactionVolume_df] DEFAULT 0,
    [totalTransactionValue]  DECIMAL(18,2) NOT NULL CONSTRAINT [BranchMetric_totalTransactionValue_df]  DEFAULT 0.00,
    [commissionOnDeposits]   DECIMAL(18,2) NOT NULL CONSTRAINT [BranchMetric_commissionOnDeposits_df]   DEFAULT 0.00,
    [commissionOnWithdrawals]DECIMAL(18,2) NOT NULL CONSTRAINT [BranchMetric_commissionOnWithdrawals_df]DEFAULT 0.00,
    [totalCommission]        DECIMAL(18,2) NOT NULL CONSTRAINT [BranchMetric_totalCommission_df]        DEFAULT 0.00,
    [notes]                  VARCHAR(500)  NULL,
    [createdBy]              VARCHAR(120)  NULL,
    [createdAt]              DATETIME2     NOT NULL CONSTRAINT [BranchMetric_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt]              DATETIME2     NOT NULL,
    CONSTRAINT [BranchMetric_pkey]    PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [uq_branch_date]       UNIQUE NONCLUSTERED ([branchId], [metricDate])
);

CREATE INDEX [BranchMetric_metricDate_idx]         ON [BranchMetric]([metricDate]);
CREATE INDEX [BranchMetric_branchId_metricDate_idx] ON [BranchMetric]([branchId], [metricDate]);

-- ── AgentLineMetric ──────────────────────────────────────────────────────────

CREATE TABLE [AgentLineMetric] (
    [id]                     BIGINT        NOT NULL IDENTITY(1,1),
    [agentLineId]            BIGINT        NOT NULL,
    [metricDate]             DATE          NOT NULL,
    [eFloatBalance]          DECIMAL(18,2) NOT NULL CONSTRAINT [AgentLineMetric_eFloatBalance_df]          DEFAULT 0.00,
    [cashInVolume]           INT           NOT NULL CONSTRAINT [AgentLineMetric_cashInVolume_df]           DEFAULT 0,
    [cashInValue]            DECIMAL(18,2) NOT NULL CONSTRAINT [AgentLineMetric_cashInValue_df]            DEFAULT 0.00,
    [cashOutVolume]          INT           NOT NULL CONSTRAINT [AgentLineMetric_cashOutVolume_df]          DEFAULT 0,
    [cashOutValue]           DECIMAL(18,2) NOT NULL CONSTRAINT [AgentLineMetric_cashOutValue_df]           DEFAULT 0.00,
    [totalTransactionVolume] INT           NOT NULL CONSTRAINT [AgentLineMetric_totalTransactionVolume_df] DEFAULT 0,
    [totalTransactionValue]  DECIMAL(18,2) NOT NULL CONSTRAINT [AgentLineMetric_totalTransactionValue_df]  DEFAULT 0.00,
    [commissionOnDeposits]   DECIMAL(18,2) NOT NULL CONSTRAINT [AgentLineMetric_commissionOnDeposits_df]   DEFAULT 0.00,
    [commissionOnWithdrawals]DECIMAL(18,2) NOT NULL CONSTRAINT [AgentLineMetric_commissionOnWithdrawals_df]DEFAULT 0.00,
    [totalCommission]        DECIMAL(18,2) NOT NULL CONSTRAINT [AgentLineMetric_totalCommission_df]        DEFAULT 0.00,
    [notes]                  VARCHAR(500)  NULL,
    [createdBy]              VARCHAR(120)  NULL,
    [createdAt]              DATETIME2     NOT NULL CONSTRAINT [AgentLineMetric_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt]              DATETIME2     NOT NULL,
    CONSTRAINT [AgentLineMetric_pkey]   PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [uq_agent_line_date]     UNIQUE NONCLUSTERED ([agentLineId], [metricDate])
);

CREATE INDEX [AgentLineMetric_metricDate_idx]            ON [AgentLineMetric]([metricDate]);
CREATE INDEX [AgentLineMetric_agentLineId_metricDate_idx] ON [AgentLineMetric]([agentLineId], [metricDate]);

-- ── Expense ──────────────────────────────────────────────────────────────────

CREATE TABLE [Expense] (
    [id]          BIGINT        NOT NULL IDENTITY(1,1),
    [branchId]    BIGINT        NOT NULL,
    [expenseType] VARCHAR(30)   NOT NULL,
    [period]      CHAR(7)       NOT NULL,
    [dueDate]     DATE          NOT NULL,
    [amount]      DECIMAL(18,2) NOT NULL,
    [currency]    CHAR(3)       NOT NULL CONSTRAINT [Expense_currency_df]   DEFAULT 'USD',
    [vendor]      VARCHAR(120)  NULL,
    [notes]       VARCHAR(500)  NULL,
    [createdBy]   VARCHAR(120)  NULL,
    [createdAt]   DATETIME2     NOT NULL CONSTRAINT [Expense_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt]   DATETIME2     NOT NULL,
    CONSTRAINT [Expense_pkey]                         PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Expense_branchId_expenseType_period_key] UNIQUE NONCLUSTERED ([branchId], [expenseType], [period])
);

CREATE INDEX [Expense_branchId_period_idx] ON [Expense]([branchId], [period]);
CREATE INDEX [Expense_dueDate_idx]          ON [Expense]([dueDate]);
CREATE INDEX [Expense_expenseType_idx]      ON [Expense]([expenseType]);

-- ── AlertRule ────────────────────────────────────────────────────────────────

CREATE TABLE [AlertRule] (
    [id]        BIGINT      NOT NULL IDENTITY(1,1),
    [ruleType]  VARCHAR(30) NOT NULL,
    [dayOffset] INT         NOT NULL,
    [isActive]  BIT         NOT NULL CONSTRAINT [AlertRule_isActive_df]  DEFAULT 1,
    [createdAt] DATETIME2   NOT NULL CONSTRAINT [AlertRule_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [AlertRule_pkey]        PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [uq_rule_type_offset]   UNIQUE NONCLUSTERED ([ruleType], [dayOffset])
);

-- ── AlertLog ─────────────────────────────────────────────────────────────────

CREATE TABLE [AlertLog] (
    [id]               BIGINT       NOT NULL IDENTITY(1,1),
    [expenseId]        BIGINT       NOT NULL,
    [ruleId]           BIGINT       NOT NULL,
    [ruleType]         VARCHAR(30)  NOT NULL,
    [dayOffset]        INT          NOT NULL,
    [triggerLocalDate] DATE         NOT NULL,
    [sentTo]           VARCHAR(190) NOT NULL,
    [sentAt]           DATETIME2    NOT NULL CONSTRAINT [AlertLog_sentAt_df] DEFAULT CURRENT_TIMESTAMP,
    [status]           VARCHAR(20)  NOT NULL CONSTRAINT [AlertLog_status_df] DEFAULT 'SENT',
    [errorMessage]     VARCHAR(500) NULL,
    CONSTRAINT [AlertLog_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE INDEX [AlertLog_expenseId_idx]       ON [AlertLog]([expenseId]);
CREATE INDEX [AlertLog_ruleId_idx]          ON [AlertLog]([ruleId]);
CREATE INDEX [idx_alert_dedupe_lookup]      ON [AlertLog]([expenseId], [ruleId], [triggerLocalDate], [status]);
CREATE INDEX [AlertLog_sentAt_idx]          ON [AlertLog]([sentAt]);

-- ── JobLock ──────────────────────────────────────────────────────────────────

CREATE TABLE [JobLock] (
    [jobName]     VARCHAR(100) NOT NULL,
    [lockedUntil] DATETIME2    NOT NULL,
    [lockedBy]    VARCHAR(100) NOT NULL,
    [createdAt]   DATETIME2    NOT NULL CONSTRAINT [JobLock_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt]   DATETIME2    NOT NULL,
    CONSTRAINT [JobLock_pkey] PRIMARY KEY CLUSTERED ([jobName])
);

-- ── Foreign keys ─────────────────────────────────────────────────────────────

ALTER TABLE [BranchAgentLine] ADD CONSTRAINT [BranchAgentLine_branchId_fkey]
    FOREIGN KEY ([branchId]) REFERENCES [Branch]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE [BranchMetric] ADD CONSTRAINT [BranchMetric_branchId_fkey]
    FOREIGN KEY ([branchId]) REFERENCES [Branch]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE [AgentLineMetric] ADD CONSTRAINT [AgentLineMetric_agentLineId_fkey]
    FOREIGN KEY ([agentLineId]) REFERENCES [BranchAgentLine]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE [Expense] ADD CONSTRAINT [Expense_branchId_fkey]
    FOREIGN KEY ([branchId]) REFERENCES [Branch]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE [AlertLog] ADD CONSTRAINT [AlertLog_expenseId_fkey]
    FOREIGN KEY ([expenseId]) REFERENCES [Expense]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE [AlertLog] ADD CONSTRAINT [AlertLog_ruleId_fkey]
    FOREIGN KEY ([ruleId]) REFERENCES [AlertRule]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
