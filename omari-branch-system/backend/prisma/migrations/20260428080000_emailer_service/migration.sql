CREATE TABLE [EmailRecipient] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [email] VARCHAR(190) NOT NULL,
    [name] VARCHAR(120) NULL,
    [isActive] BIT NOT NULL CONSTRAINT [EmailRecipient_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmailRecipient_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [EmailRecipient_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [uq_email_recipient_email] UNIQUE NONCLUSTERED ([email])
);

CREATE INDEX [EmailRecipient_email_idx] ON [EmailRecipient]([email]);
CREATE INDEX [EmailRecipient_isActive_idx] ON [EmailRecipient]([isActive]);

CREATE TABLE [EmailSubscription] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [recipientId] BIGINT NOT NULL,
    [emailType] VARCHAR(40) NOT NULL,
    [branchId] BIGINT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [EmailSubscription_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmailSubscription_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [EmailSubscription_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [uq_email_subscription_scope] UNIQUE NONCLUSTERED ([recipientId], [emailType], [branchId])
);

CREATE INDEX [EmailSubscription_emailType_isActive_idx] ON [EmailSubscription]([emailType], [isActive]);
CREATE INDEX [EmailSubscription_branchId_idx] ON [EmailSubscription]([branchId]);

CREATE TABLE [EmailLog] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [emailType] VARCHAR(40) NOT NULL,
    [recipientId] BIGINT NULL,
    [sentTo] VARCHAR(190) NOT NULL,
    [subject] VARCHAR(255) NOT NULL,
    [status] VARCHAR(20) NOT NULL CONSTRAINT [EmailLog_status_df] DEFAULT 'SENT',
    [errorMessage] VARCHAR(500) NULL,
    [sentAt] DATETIME2 NOT NULL CONSTRAINT [EmailLog_sentAt_df] DEFAULT CURRENT_TIMESTAMP,
    [branchId] BIGINT NULL,
    [expenseId] BIGINT NULL,
    [recurringReminderId] BIGINT NULL,
    [reportDate] DATE NULL,
    [metadata] VARCHAR(1000) NULL,
    CONSTRAINT [EmailLog_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE INDEX [EmailLog_emailType_sentAt_idx] ON [EmailLog]([emailType], [sentAt]);
CREATE INDEX [EmailLog_status_idx] ON [EmailLog]([status]);
CREATE INDEX [EmailLog_branchId_idx] ON [EmailLog]([branchId]);
CREATE INDEX [EmailLog_expenseId_idx] ON [EmailLog]([expenseId]);
CREATE INDEX [EmailLog_recurringReminderId_idx] ON [EmailLog]([recurringReminderId]);
CREATE INDEX [EmailLog_reportDate_idx] ON [EmailLog]([reportDate]);

ALTER TABLE [EmailSubscription] ADD CONSTRAINT [EmailSubscription_recipientId_fkey]
    FOREIGN KEY ([recipientId]) REFERENCES [EmailRecipient]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE [EmailSubscription] ADD CONSTRAINT [EmailSubscription_branchId_fkey]
    FOREIGN KEY ([branchId]) REFERENCES [Branch]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE [EmailLog] ADD CONSTRAINT [EmailLog_recipientId_fkey]
    FOREIGN KEY ([recipientId]) REFERENCES [EmailRecipient]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE [EmailLog] ADD CONSTRAINT [EmailLog_branchId_fkey]
    FOREIGN KEY ([branchId]) REFERENCES [Branch]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [EmailLog] ADD CONSTRAINT [EmailLog_expenseId_fkey]
    FOREIGN KEY ([expenseId]) REFERENCES [Expense]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE TABLE [RecurringExpenseReminder] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [branchId] BIGINT NOT NULL,
    [expenseType] VARCHAR(30) NOT NULL,
    [dueDayOfMonth] INT NOT NULL,
    [amount] DECIMAL(18,2) NOT NULL,
    [currency] CHAR(3) NOT NULL CONSTRAINT [RecurringExpenseReminder_currency_df] DEFAULT 'USD',
    [vendor] VARCHAR(120) NULL,
    [notes] VARCHAR(500) NULL,
    [isActive] BIT NOT NULL CONSTRAINT [RecurringExpenseReminder_isActive_df] DEFAULT 1,
    [createdBy] VARCHAR(120) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [RecurringExpenseReminder_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [RecurringExpenseReminder_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE INDEX [RecurringExpenseReminder_branchId_idx] ON [RecurringExpenseReminder]([branchId]);
CREATE INDEX [RecurringExpenseReminder_expenseType_idx] ON [RecurringExpenseReminder]([expenseType]);
CREATE INDEX [RecurringExpenseReminder_isActive_idx] ON [RecurringExpenseReminder]([isActive]);

ALTER TABLE [RecurringExpenseReminder] ADD CONSTRAINT [RecurringExpenseReminder_branchId_fkey]
    FOREIGN KEY ([branchId]) REFERENCES [Branch]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE [EmailLog] ADD CONSTRAINT [EmailLog_recurringReminderId_fkey]
    FOREIGN KEY ([recurringReminderId]) REFERENCES [RecurringExpenseReminder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

INSERT INTO [EmailRecipient] ([email], [name], [isActive], [createdAt], [updatedAt])
SELECT [email], [name], [isActive], [createdAt], [updatedAt]
FROM [ReminderRecipient] AS [rr]
WHERE NOT EXISTS (
    SELECT 1 FROM [EmailRecipient] AS [er] WHERE [er].[email] = [rr].[email]
);

INSERT INTO [EmailSubscription] ([recipientId], [emailType], [branchId], [isActive], [createdAt], [updatedAt])
SELECT [er].[id], 'REMINDER', NULL, [rr].[isActive], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM [ReminderRecipient] AS [rr]
JOIN [EmailRecipient] AS [er] ON [er].[email] = [rr].[email];
