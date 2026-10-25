"""exact money ledger and durable LINE integration

Revision ID: a1022lf00001
Revises: a1002cf00004
Create Date: 2026-10-22 23:21:00.022977

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1022lf00001'
down_revision: Union[str, Sequence[str], None] = 'a1002cf00004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Additive schema; historical composite indexes remain unchanged.
    op.create_table('finance_ledger_drafts',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('owner_id', sa.String(length=36), nullable=False),
    sa.Column('version', sa.Integer(), nullable=False),
    sa.Column('status', sa.String(length=24), nullable=False),
    sa.Column('payload', sa.JSON(), nullable=False),
    sa.Column('posted_journal_id', sa.String(length=36), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['owner_id', 'posted_journal_id'], ['journal_entries.owner_id', 'journal_entries.id'], name='fk_draft_posted_journal', use_alter=True),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('owner_id', 'id')
    )
    with op.batch_alter_table('finance_ledger_drafts', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_finance_ledger_drafts_owner_id'), ['owner_id'], unique=False)

    op.create_table('finance_line_identities',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('channel_id', sa.String(length=128), nullable=False),
    sa.Column('actor_id', sa.String(length=128), nullable=False),
    sa.Column('owner_id', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('revoked_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('owner_id', 'id')
    )
    with op.batch_alter_table('finance_line_identities', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_finance_line_identities_owner_id'), ['owner_id'], unique=False)
        batch_op.create_index('uq_finance_line_actor', ['channel_id', 'actor_id'], unique=True, sqlite_where=sa.text('revoked_at IS NULL'), postgresql_where=sa.text('revoked_at IS NULL'))
        batch_op.create_index('uq_finance_line_owner', ['channel_id', 'owner_id'], unique=True, sqlite_where=sa.text('revoked_at IS NULL'), postgresql_where=sa.text('revoked_at IS NULL'))

    op.create_table('finance_link_challenges',
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('channel_id', sa.String(length=128), nullable=False),
    sa.Column('owner_id', sa.String(length=36), nullable=False),
    sa.Column('expires_at', sa.DateTime(), nullable=False),
    sa.Column('consumed_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('token_hash')
    )
    with op.batch_alter_table('finance_link_challenges', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_finance_link_challenges_owner_id'), ['owner_id'], unique=False)

    op.create_table('journal_entries',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('owner_id', sa.String(length=36), nullable=False),
    sa.Column('kind', sa.String(length=24), nullable=False),
    sa.Column('currency', sa.String(length=3), nullable=False),
    sa.Column('occurred_on', sa.Date(), nullable=False),
    sa.Column('occurred_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('precision', sa.String(length=12), nullable=False),
    sa.Column('source_draft_id', sa.String(length=36), nullable=True),
    sa.Column('reversal_of', sa.String(length=36), nullable=True),
    sa.Column('original_expense_entry_id', sa.String(length=36), nullable=True),
    sa.Column('correction_group', sa.String(length=36), nullable=True),
    sa.Column('description', sa.String(length=500), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('created_txid', sa.BigInteger(), server_default=sa.text('0'), nullable=False),
    sa.CheckConstraint("currency = 'THB'", name='ck_journal_thb'),
    sa.CheckConstraint("precision IN ('day','instant')", name='ck_journal_precision'),
    sa.ForeignKeyConstraint(['owner_id', 'original_expense_entry_id'], ['journal_entries.owner_id', 'journal_entries.id'], ),
    sa.ForeignKeyConstraint(['owner_id', 'reversal_of'], ['journal_entries.owner_id', 'journal_entries.id'], ),
    sa.ForeignKeyConstraint(['owner_id', 'source_draft_id'], ['finance_ledger_drafts.owner_id', 'finance_ledger_drafts.id'], name='fk_journal_source_draft', use_alter=True),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('owner_id', 'id'),
    sa.UniqueConstraint('reversal_of'),
    sa.UniqueConstraint('source_draft_id')
    )
    with op.batch_alter_table('journal_entries', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_journal_entries_occurred_on'), ['occurred_on'], unique=False)
        batch_op.create_index(batch_op.f('ix_journal_entries_owner_id'), ['owner_id'], unique=False)

    op.create_table('ledger_accounts',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('owner_id', sa.String(length=36), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('kind', sa.String(length=16), nullable=False),
    sa.Column('subtype', sa.String(length=16), nullable=False),
    sa.Column('currency', sa.String(length=3), nullable=False),
    sa.Column('visible', sa.Boolean(), nullable=False),
    sa.Column('archived', sa.Boolean(), nullable=False),
    sa.Column('system_key', sa.String(length=32), nullable=True),
    sa.CheckConstraint("currency = 'THB'", name='ck_ledger_account_thb'),
    sa.CheckConstraint("kind IN ('asset','liability','income','expense','equity')", name='ck_ledger_account_kind'),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('owner_id', 'id'),
    sa.UniqueConstraint('owner_id', 'system_key')
    )
    with op.batch_alter_table('ledger_accounts', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_ledger_accounts_owner_id'), ['owner_id'], unique=False)

    op.create_table('ledger_audits',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('owner_id', sa.String(length=36), nullable=False),
    sa.Column('operation', sa.String(length=40), nullable=False),
    sa.Column('resource_id', sa.String(length=36), nullable=False),
    sa.Column('details', sa.JSON(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('ledger_audits', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_ledger_audits_owner_id'), ['owner_id'], unique=False)

    op.create_table('ledger_idempotency',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('owner_id', sa.String(length=36), nullable=False),
    sa.Column('namespace', sa.String(length=128), nullable=False),
    sa.Column('key', sa.String(length=128), nullable=False),
    sa.Column('request_hash', sa.String(length=64), nullable=False),
    sa.Column('result', sa.JSON(), nullable=False),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('owner_id', 'namespace', 'key')
    )
    with op.batch_alter_table('ledger_idempotency', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_ledger_idempotency_owner_id'), ['owner_id'], unique=False)

    op.create_table('finance_action_capabilities',
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('owner_id', sa.String(length=36), nullable=False),
    sa.Column('identity_id', sa.String(length=36), nullable=False),
    sa.Column('draft_id', sa.String(length=36), nullable=False),
    sa.Column('draft_version', sa.Integer(), nullable=False),
    sa.Column('action', sa.String(length=16), nullable=False),
    sa.Column('expires_at', sa.DateTime(), nullable=False),
    sa.Column('consumed_at', sa.DateTime(), nullable=True),
    sa.Column('result', sa.JSON(), nullable=True),
    sa.ForeignKeyConstraint(['draft_id'], ['finance_ledger_drafts.id'], ),
    sa.ForeignKeyConstraint(['identity_id'], ['finance_line_identities.id'], ),
    sa.ForeignKeyConstraint(['owner_id', 'draft_id'], ['finance_ledger_drafts.owner_id', 'finance_ledger_drafts.id'], ),
    sa.ForeignKeyConstraint(['owner_id', 'identity_id'], ['finance_line_identities.owner_id', 'finance_line_identities.id'], ),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('token_hash')
    )
    with op.batch_alter_table('finance_action_capabilities', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_finance_action_capabilities_owner_id'), ['owner_id'], unique=False)

    op.create_table('finance_inbox',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('channel_id', sa.String(length=128), nullable=False),
    sa.Column('event_id', sa.String(length=128), nullable=False),
    sa.Column('actor_id', sa.String(length=128), nullable=True),
    sa.Column('identity_id', sa.String(length=36), nullable=True),
    sa.Column('owner_id', sa.String(length=36), nullable=True),
    sa.Column('kind', sa.String(length=24), nullable=False),
    sa.Column('state', sa.String(length=24), nullable=False),
    sa.Column('safe_code', sa.String(length=64), nullable=True),
    sa.Column('message_id', sa.String(length=128), nullable=True),
    sa.Column('source_timestamp', sa.BigInteger(), nullable=True),
    sa.Column('payload', sa.JSON(), nullable=False),
    sa.Column('received_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['identity_id'], ['finance_line_identities.id'], ),
    sa.ForeignKeyConstraint(['owner_id', 'identity_id'], ['finance_line_identities.owner_id', 'finance_line_identities.id'], ),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('channel_id', 'event_id', name='uq_finance_inbox_event'),
    sa.UniqueConstraint('owner_id', 'id')
    )
    with op.batch_alter_table('finance_inbox', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_finance_inbox_owner_id'), ['owner_id'], unique=False)

    op.create_table('finance_notification_outbox',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('owner_id', sa.String(length=36), nullable=False),
    sa.Column('identity_id', sa.String(length=36), nullable=False),
    sa.Column('purpose', sa.String(length=32), nullable=False),
    sa.Column('payload', sa.JSON(), nullable=False),
    sa.Column('state', sa.String(length=24), nullable=False),
    sa.Column('attempts', sa.Integer(), nullable=False),
    sa.Column('generation', sa.Integer(), server_default='0', nullable=False),
    sa.Column('lease_hash', sa.String(length=64), nullable=True),
    sa.Column('lease_until', sa.DateTime(), nullable=True),
    sa.Column('next_at', sa.DateTime(), nullable=False),
    sa.Column('provider_ack', sa.String(length=128), nullable=True),
    sa.Column('safe_code', sa.String(length=64), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['identity_id'], ['finance_line_identities.id'], ),
    sa.ForeignKeyConstraint(['owner_id', 'identity_id'], ['finance_line_identities.owner_id', 'finance_line_identities.id'], ),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('finance_notification_outbox', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_finance_notification_outbox_owner_id'), ['owner_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_finance_notification_outbox_state'), ['state'], unique=False)

    op.create_table('finance_statement_imports',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('owner_id', sa.String(length=36), nullable=False),
    sa.Column('account_id', sa.String(length=36), nullable=False),
    sa.Column('request_key', sa.String(length=80), nullable=False),
    sa.Column('request_hash', sa.String(length=64), nullable=False),
    sa.Column('content_hash', sa.String(length=64), nullable=False),
    sa.Column('period_start', sa.Date(), nullable=False),
    sa.Column('period_end', sa.Date(), nullable=False),
    sa.Column('opening_balance_minor', sa.BigInteger(), nullable=False),
    sa.Column('closing_balance_minor', sa.BigInteger(), nullable=False),
    sa.Column('line_ids', sa.JSON(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['owner_id', 'account_id'], ['ledger_accounts.owner_id', 'ledger_accounts.id'], ),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('owner_id', 'account_id', 'content_hash'),
    sa.UniqueConstraint('owner_id', 'id'),
    sa.UniqueConstraint('owner_id', 'request_key')
    )
    with op.batch_alter_table('finance_statement_imports', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_finance_statement_imports_owner_id'), ['owner_id'], unique=False)

    op.create_table('financial_transaction_projections',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('owner_id', sa.String(length=36), nullable=False),
    sa.Column('journal_entry_id', sa.String(length=36), nullable=False),
    sa.Column('operation_kind', sa.String(length=24), nullable=False),
    sa.Column('amount_minor', sa.BigInteger(), nullable=False),
    sa.Column('income_effect_minor', sa.BigInteger(), nullable=False),
    sa.Column('expense_effect_minor', sa.BigInteger(), nullable=False),
    sa.Column('category', sa.String(length=100), nullable=False),
    sa.Column('trip_id', sa.String(length=36), nullable=True),
    sa.Column('tags', sa.JSON(), nullable=False),
    sa.ForeignKeyConstraint(['owner_id', 'journal_entry_id'], ['journal_entries.owner_id', 'journal_entries.id'], ),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['trip_id'], ['trips.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('journal_entry_id')
    )
    with op.batch_alter_table('financial_transaction_projections', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_financial_transaction_projections_owner_id'), ['owner_id'], unique=False)

    op.create_table('ledger_economic_identities',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('owner_id', sa.String(length=36), nullable=False),
    sa.Column('key_hash', sa.String(length=64), nullable=False),
    sa.Column('journal_id', sa.String(length=36), nullable=False),
    sa.ForeignKeyConstraint(['owner_id', 'journal_id'], ['journal_entries.owner_id', 'journal_entries.id'], ),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('owner_id', 'key_hash')
    )
    op.create_table('ledger_notifications',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('owner_id', sa.String(length=36), nullable=False),
    sa.Column('draft_id', sa.String(length=36), nullable=True),
    sa.Column('journal_id', sa.String(length=36), nullable=False),
    sa.Column('purpose', sa.String(length=32), nullable=False),
    sa.Column('payload', sa.JSON(), nullable=False),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.ForeignKeyConstraint(['journal_id'], ['journal_entries.id'], ),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('journal_id', 'purpose')
    )
    with op.batch_alter_table('ledger_notifications', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_ledger_notifications_owner_id'), ['owner_id'], unique=False)

    op.create_table('ledger_openings',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('owner_id', sa.String(length=36), nullable=False),
    sa.Column('account_id', sa.String(length=36), nullable=False),
    sa.Column('cutoff_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('signed_balance_minor', sa.BigInteger(), nullable=False),
    sa.Column('journal_id', sa.String(length=36), nullable=True),
    sa.Column('setup_key', sa.String(length=128), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['owner_id', 'account_id'], ['ledger_accounts.owner_id', 'ledger_accounts.id'], ),
    sa.ForeignKeyConstraint(['owner_id', 'journal_id'], ['journal_entries.owner_id', 'journal_entries.id'], ),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('account_id'),
    sa.UniqueConstraint('owner_id', 'setup_key', 'account_id')
    )
    with op.batch_alter_table('ledger_openings', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_ledger_openings_owner_id'), ['owner_id'], unique=False)

    op.create_table('ledger_postings',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('owner_id', sa.String(length=36), nullable=False),
    sa.Column('journal_id', sa.String(length=36), nullable=False),
    sa.Column('account_id', sa.String(length=36), nullable=False),
    sa.Column('amount_minor', sa.BigInteger(), nullable=False),
    sa.CheckConstraint('amount_minor <> 0', name='ck_posting_nonzero'),
    sa.ForeignKeyConstraint(['owner_id', 'account_id'], ['ledger_accounts.owner_id', 'ledger_accounts.id'], ),
    sa.ForeignKeyConstraint(['owner_id', 'journal_id'], ['journal_entries.owner_id', 'journal_entries.id'], ),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('ledger_postings', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_ledger_postings_account_id'), ['account_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_ledger_postings_journal_id'), ['journal_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_ledger_postings_owner_id'), ['owner_id'], unique=False)

    op.create_table('finance_evidence',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('event_id', sa.String(length=36), nullable=False),
    sa.Column('owner_id', sa.String(length=36), nullable=False),
    sa.Column('storage_key', sa.String(length=64), nullable=False),
    sa.Column('mime', sa.String(length=64), nullable=False),
    sa.Column('size', sa.Integer(), nullable=False),
    sa.Column('sha256', sa.String(length=64), nullable=False),
    sa.Column('state', sa.String(length=24), nullable=False),
    sa.Column('extraction', sa.JSON(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['event_id'], ['finance_inbox.id'], ),
    sa.ForeignKeyConstraint(['owner_id', 'event_id'], ['finance_inbox.owner_id', 'finance_inbox.id'], ),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('event_id', name='uq_finance_evidence_event'),
    sa.UniqueConstraint('owner_id', 'id')
    )
    with op.batch_alter_table('finance_evidence', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_finance_evidence_owner_id'), ['owner_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_finance_evidence_sha256'), ['sha256'], unique=False)

    op.create_table('finance_integration_jobs',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('event_id', sa.String(length=36), nullable=False),
    sa.Column('owner_id', sa.String(length=36), nullable=False),
    sa.Column('kind', sa.String(length=24), nullable=False),
    sa.Column('state', sa.String(length=24), nullable=False),
    sa.Column('attempts', sa.Integer(), nullable=False),
    sa.Column('generation', sa.Integer(), nullable=False),
    sa.Column('lease_hash', sa.String(length=64), nullable=True),
    sa.Column('lease_until', sa.DateTime(), nullable=True),
    sa.Column('available_at', sa.DateTime(), nullable=False),
    sa.Column('result', sa.JSON(), nullable=True),
    sa.Column('result_hash', sa.String(length=64), nullable=True),
    sa.Column('safe_code', sa.String(length=64), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['event_id'], ['finance_inbox.id'], ),
    sa.ForeignKeyConstraint(['owner_id', 'event_id'], ['finance_inbox.owner_id', 'finance_inbox.id'], ),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('event_id', 'kind', name='uq_finance_job_event_kind')
    )
    with op.batch_alter_table('finance_integration_jobs', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_finance_integration_jobs_owner_id'), ['owner_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_finance_integration_jobs_state'), ['state'], unique=False)

    op.create_table('finance_statement_lines',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('owner_id', sa.String(length=36), nullable=False),
    sa.Column('import_id', sa.String(length=36), nullable=False),
    sa.Column('account_id', sa.String(length=36), nullable=False),
    sa.Column('stable_key', sa.String(length=128), nullable=False),
    sa.Column('occurred_on', sa.Date(), nullable=False),
    sa.Column('amount_minor', sa.BigInteger(), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('reference', sa.String(length=160), nullable=False),
    sa.Column('description', sa.String(length=500), nullable=False),
    sa.Column('matched_journal_id', sa.String(length=36), nullable=True),
    sa.Column('draft_id', sa.String(length=36), nullable=True),
    sa.ForeignKeyConstraint(['owner_id', 'account_id'], ['ledger_accounts.owner_id', 'ledger_accounts.id'], ),
    sa.ForeignKeyConstraint(['owner_id', 'draft_id'], ['finance_ledger_drafts.owner_id', 'finance_ledger_drafts.id'], ),
    sa.ForeignKeyConstraint(['owner_id', 'import_id'], ['finance_statement_imports.owner_id', 'finance_statement_imports.id'], ),
    sa.ForeignKeyConstraint(['owner_id', 'matched_journal_id'], ['journal_entries.owner_id', 'journal_entries.id'], ),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('owner_id', 'account_id', 'matched_journal_id'),
    sa.UniqueConstraint('owner_id', 'account_id', 'stable_key')
    )
    with op.batch_alter_table('finance_statement_lines', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_finance_statement_lines_owner_id'), ['owner_id'], unique=False)

    op.create_table('finance_entry_evidence',
    sa.Column('owner_id', sa.String(length=36), nullable=False),
    sa.Column('evidence_id', sa.String(length=36), nullable=False),
    sa.Column('journal_id', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['owner_id', 'evidence_id'], ['finance_evidence.owner_id', 'finance_evidence.id'], ),
    sa.ForeignKeyConstraint(['owner_id', 'journal_id'], ['journal_entries.owner_id', 'journal_entries.id'], ),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('evidence_id', 'journal_id')
    )




    with op.batch_alter_table('transactions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('origin', sa.String(length=32), server_default='legacy', nullable=False))
        batch_op.add_column(sa.Column('nonposting_history', sa.Boolean(), server_default='1', nullable=False))
        batch_op.add_column(sa.Column('migration_currency', sa.String(length=3), nullable=True))
        batch_op.add_column(sa.Column('migrated_journal_id', sa.String(length=36), nullable=True))
        batch_op.create_unique_constraint('uq_transactions_migrated_journal', ['migrated_journal_id'])
        batch_op.create_foreign_key('fk_legacy_migrated_journal_owner', 'journal_entries', ['user_id', 'migrated_journal_id'], ['owner_id', 'id'])

    op.create_table('finance_delivery_budgets',
        sa.Column('channel_id', sa.String(length=128), primary_key=True),
        sa.Column('day', sa.String(length=10), primary_key=True),
        sa.Column('attempts', sa.Integer(), server_default='0', nullable=False))



    _protect_ledger()


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    for table in ('journal_entries', 'ledger_openings', 'finance_ledger_drafts', 'finance_evidence', 'finance_line_identities'):
        if bind.execute(sa.text(f'SELECT count(*) FROM {table}')).scalar():
            raise RuntimeError('Ledger history or integration data exists; disable exposure and preserve additive schema on operational rollback')
    if bind.dialect.name == 'postgresql':
        op.drop_constraint('fk_draft_posted_journal', 'finance_ledger_drafts', type_='foreignkey')
        op.drop_constraint('fk_journal_source_draft', 'journal_entries', type_='foreignkey')
    # Additive schema; historical composite indexes remain unchanged.


    with op.batch_alter_table('transactions', schema=None) as batch_op:
        batch_op.drop_constraint('fk_legacy_migrated_journal_owner', type_='foreignkey')
        batch_op.drop_constraint('uq_transactions_migrated_journal', type_='unique')
        batch_op.drop_column('migrated_journal_id')
        batch_op.drop_column('migration_currency')
        batch_op.drop_column('nonposting_history')
        batch_op.drop_column('origin')





    op.drop_table('finance_entry_evidence')
    op.drop_table('finance_delivery_budgets')
    with op.batch_alter_table('finance_statement_lines', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_finance_statement_lines_owner_id'))

    op.drop_table('finance_statement_lines')
    with op.batch_alter_table('finance_integration_jobs', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_finance_integration_jobs_state'))
        batch_op.drop_index(batch_op.f('ix_finance_integration_jobs_owner_id'))

    op.drop_table('finance_integration_jobs')
    with op.batch_alter_table('finance_evidence', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_finance_evidence_sha256'))
        batch_op.drop_index(batch_op.f('ix_finance_evidence_owner_id'))

    op.drop_table('finance_evidence')
    with op.batch_alter_table('ledger_postings', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_ledger_postings_owner_id'))
        batch_op.drop_index(batch_op.f('ix_ledger_postings_journal_id'))
        batch_op.drop_index(batch_op.f('ix_ledger_postings_account_id'))

    op.drop_table('ledger_postings')
    with op.batch_alter_table('ledger_openings', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_ledger_openings_owner_id'))

    op.drop_table('ledger_openings')
    with op.batch_alter_table('ledger_notifications', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_ledger_notifications_owner_id'))

    op.drop_table('ledger_notifications')
    op.drop_table('ledger_economic_identities')
    with op.batch_alter_table('financial_transaction_projections', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_financial_transaction_projections_owner_id'))

    op.drop_table('financial_transaction_projections')
    with op.batch_alter_table('finance_statement_imports', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_finance_statement_imports_owner_id'))

    op.drop_table('finance_statement_imports')
    with op.batch_alter_table('finance_notification_outbox', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_finance_notification_outbox_state'))
        batch_op.drop_index(batch_op.f('ix_finance_notification_outbox_owner_id'))

    op.drop_table('finance_notification_outbox')
    with op.batch_alter_table('finance_inbox', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_finance_inbox_owner_id'))

    op.drop_table('finance_inbox')
    with op.batch_alter_table('finance_action_capabilities', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_finance_action_capabilities_owner_id'))

    op.drop_table('finance_action_capabilities')
    with op.batch_alter_table('ledger_idempotency', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_ledger_idempotency_owner_id'))

    op.drop_table('ledger_idempotency')
    with op.batch_alter_table('ledger_audits', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_ledger_audits_owner_id'))

    op.drop_table('ledger_audits')
    with op.batch_alter_table('ledger_accounts', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_ledger_accounts_owner_id'))

    op.drop_table('ledger_accounts')
    with op.batch_alter_table('journal_entries', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_journal_entries_owner_id'))
        batch_op.drop_index(batch_op.f('ix_journal_entries_occurred_on'))

    op.drop_table('journal_entries')
    with op.batch_alter_table('finance_link_challenges', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_finance_link_challenges_owner_id'))

    op.drop_table('finance_link_challenges')
    with op.batch_alter_table('finance_line_identities', schema=None) as batch_op:
        batch_op.drop_index('uq_finance_line_owner', sqlite_where=sa.text('revoked_at IS NULL'), postgresql_where=sa.text('revoked_at IS NULL'))
        batch_op.drop_index('uq_finance_line_actor', sqlite_where=sa.text('revoked_at IS NULL'), postgresql_where=sa.text('revoked_at IS NULL'))
        batch_op.drop_index(batch_op.f('ix_finance_line_identities_owner_id'))

    op.drop_table('finance_line_identities')
    with op.batch_alter_table('finance_ledger_drafts', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_finance_ledger_drafts_owner_id'))

    op.drop_table('finance_ledger_drafts')
    if bind.dialect.name == 'postgresql':
        for function in ('finance_assert_journal', 'finance_immutable', 'finance_new_posting', 'finance_account_semantics', 'finance_projection_immutable'):
            op.execute(f'DROP FUNCTION {function}()')
    # ### end Alembic commands ###


def _protect_ledger():
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.create_foreign_key('fk_draft_posted_journal', 'finance_ledger_drafts', 'journal_entries', ['owner_id', 'posted_journal_id'], ['owner_id', 'id'])
        op.create_foreign_key('fk_journal_source_draft', 'journal_entries', 'finance_ledger_drafts', ['owner_id', 'source_draft_id'], ['owner_id', 'id'])
        op.execute('ALTER TABLE journal_entries ALTER COLUMN created_txid SET DEFAULT txid_current()')
        op.execute('''
CREATE FUNCTION finance_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'committed financial history is append-only'; END $$;

CREATE FUNCTION finance_new_posting() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE id = NEW.journal_id AND owner_id = NEW.owner_id AND created_txid = txid_current()) THEN
    RAISE EXCEPTION 'postings may only join a journal in its creating transaction';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION finance_account_semantics() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.owner_id, NEW.kind, NEW.subtype, NEW.currency, NEW.visible, NEW.system_key) IS DISTINCT FROM
     (OLD.owner_id, OLD.kind, OLD.subtype, OLD.currency, OLD.visible, OLD.system_key) AND
     (EXISTS (SELECT 1 FROM ledger_openings WHERE account_id = OLD.id) OR EXISTS (SELECT 1 FROM ledger_postings WHERE account_id = OLD.id)) THEN
    RAISE EXCEPTION 'account semantics are frozen after setup';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION finance_projection_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'financial projections cannot be deleted'; END IF;
  IF TG_OP = 'UPDATE' AND (NEW.owner_id, NEW.journal_entry_id, NEW.operation_kind, NEW.amount_minor, NEW.income_effect_minor, NEW.expense_effect_minor)
     IS DISTINCT FROM (OLD.owner_id, OLD.journal_entry_id, OLD.operation_kind, OLD.amount_minor, OLD.income_effect_minor, OLD.expense_effect_minor) THEN
    RAISE EXCEPTION 'derived financial effects cannot be edited';
  END IF;
  IF NEW.trip_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM trips WHERE id = NEW.trip_id AND user_id = NEW.owner_id) THEN
    RAISE EXCEPTION 'classification trip owner mismatch';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION finance_assert_journal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE jid varchar(36); n integer; total numeric; actual_income numeric; actual_expense numeric; expected_income bigint; expected_expense bigint;
BEGIN
  IF TG_TABLE_NAME = 'journal_entries' THEN jid := NEW.id; ELSE jid := NEW.journal_id; END IF;
  SELECT count(*), coalesce(sum(amount_minor::numeric), 0) INTO n,total FROM ledger_postings WHERE journal_id = jid;
  IF n < 2 OR total <> 0 THEN RAISE EXCEPTION 'journal must contain two or more balanced nonzero postings'; END IF;
  SELECT coalesce(-sum(p.amount_minor::numeric) FILTER (WHERE a.kind = 'income'),0), coalesce(sum(p.amount_minor::numeric) FILTER (WHERE a.kind = 'expense'),0)
    INTO actual_income,actual_expense FROM ledger_postings p JOIN ledger_accounts a ON a.id = p.account_id WHERE p.journal_id = jid;
  SELECT income_effect_minor,expense_effect_minor INTO expected_income,expected_expense FROM financial_transaction_projections WHERE journal_entry_id = jid;
  IF NOT FOUND OR expected_income <> actual_income OR expected_expense <> actual_expense THEN RAISE EXCEPTION 'missing or inconsistent canonical projection'; END IF;
  IF EXISTS (SELECT 1 FROM ledger_postings WHERE account_id IN (SELECT account_id FROM ledger_postings WHERE journal_id=jid)
             GROUP BY account_id HAVING abs(sum(amount_minor::numeric)) > 9223372036854775807) THEN
    RAISE EXCEPTION 'account balance overflow';
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER journal_no_change BEFORE UPDATE OR DELETE ON journal_entries FOR EACH ROW EXECUTE FUNCTION finance_immutable();
CREATE TRIGGER posting_no_change BEFORE UPDATE OR DELETE ON ledger_postings FOR EACH ROW EXECUTE FUNCTION finance_immutable();
CREATE TRIGGER opening_no_change BEFORE UPDATE OR DELETE ON ledger_openings FOR EACH ROW EXECUTE FUNCTION finance_immutable();
CREATE TRIGGER audit_no_change BEFORE UPDATE OR DELETE ON ledger_audits FOR EACH ROW EXECUTE FUNCTION finance_immutable();
CREATE TRIGGER economic_no_change BEFORE UPDATE OR DELETE ON ledger_economic_identities FOR EACH ROW EXECUTE FUNCTION finance_immutable();
CREATE TRIGGER posting_same_transaction BEFORE INSERT ON ledger_postings FOR EACH ROW EXECUTE FUNCTION finance_new_posting();
CREATE TRIGGER account_semantics BEFORE UPDATE ON ledger_accounts FOR EACH ROW EXECUTE FUNCTION finance_account_semantics();
CREATE TRIGGER projection_financial_immutable BEFORE INSERT OR UPDATE OR DELETE ON financial_transaction_projections FOR EACH ROW EXECUTE FUNCTION finance_projection_immutable();
CREATE CONSTRAINT TRIGGER balanced_journal_entry AFTER INSERT ON journal_entries DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance_assert_journal();
CREATE CONSTRAINT TRIGGER balanced_journal_posting AFTER INSERT ON ledger_postings DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance_assert_journal();
''')
    elif bind.dialect.name == 'sqlite':
        # SQLite has no deferred constraint triggers. Services validate complete
        # journals; these protections preserve append-only local history.
        for table in ('journal_entries', 'ledger_postings', 'ledger_openings', 'ledger_audits', 'ledger_economic_identities'):
            for action in ('UPDATE', 'DELETE'):
                op.execute(f"CREATE TRIGGER {table}_no_{action.lower()} BEFORE {action} ON {table} BEGIN SELECT RAISE(ABORT, 'financial history is append-only'); END")
        op.execute('''CREATE TRIGGER account_semantics BEFORE UPDATE ON ledger_accounts
WHEN (EXISTS (SELECT 1 FROM ledger_openings WHERE account_id=OLD.id) OR EXISTS (SELECT 1 FROM ledger_postings WHERE account_id=OLD.id))
AND (NEW.owner_id IS NOT OLD.owner_id OR NEW.kind IS NOT OLD.kind OR NEW.subtype IS NOT OLD.subtype OR NEW.currency IS NOT OLD.currency OR NEW.visible IS NOT OLD.visible OR NEW.system_key IS NOT OLD.system_key)
BEGIN SELECT RAISE(ABORT, 'account semantics are frozen after setup'); END''')
