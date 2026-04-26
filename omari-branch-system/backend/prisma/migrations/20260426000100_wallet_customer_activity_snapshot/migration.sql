CREATE TABLE [WalletCustomerActivitySnapshot] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [customerId] VARCHAR(120) NOT NULL,
    [fullName] VARCHAR(255) NULL,
    [mobileNumber] VARCHAR(120) NULL,
    [firstSeenDate] DATE NOT NULL,
    [lastSeenDate] DATE NOT NULL,
    [lifetimeTransactionValue] DECIMAL(18,2) NOT NULL CONSTRAINT [WalletCustomerActivitySnapshot_lifetimeTransactionValue_df] DEFAULT 0.00,
    [lifetimeTransactionVolume] INT NOT NULL CONSTRAINT [WalletCustomerActivitySnapshot_lifetimeTransactionVolume_df] DEFAULT 0,
    [lifetimeCommission] DECIMAL(18,2) NOT NULL CONSTRAINT [WalletCustomerActivitySnapshot_lifetimeCommission_df] DEFAULT 0.00,
    [last30DayTransactionValue] DECIMAL(18,2) NOT NULL CONSTRAINT [WalletCustomerActivitySnapshot_last30DayTransactionValue_df] DEFAULT 0.00,
    [last60DayTransactionValue] DECIMAL(18,2) NOT NULL CONSTRAINT [WalletCustomerActivitySnapshot_last60DayTransactionValue_df] DEFAULT 0.00,
    [sourceRowCount] INT NOT NULL CONSTRAINT [WalletCustomerActivitySnapshot_sourceRowCount_df] DEFAULT 0,
    [refreshedAt] DATETIME2 NOT NULL CONSTRAINT [WalletCustomerActivitySnapshot_refreshedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WalletCustomerActivitySnapshot_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [WalletCustomerActivitySnapshot_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [uq_wallet_customer_activity_customer_id] UNIQUE NONCLUSTERED ([customerId])
);

CREATE INDEX [WalletCustomerActivitySnapshot_lastSeenDate_idx]
ON [WalletCustomerActivitySnapshot]([lastSeenDate]);

CREATE INDEX [WalletCustomerActivitySnapshot_firstSeenDate_idx]
ON [WalletCustomerActivitySnapshot]([firstSeenDate]);

CREATE INDEX [WalletCustomerActivitySnapshot_mobileNumber_idx]
ON [WalletCustomerActivitySnapshot]([mobileNumber]);
