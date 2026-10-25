"""Serialize historical assignment and legacy mutations before reading cash data."""

from sqlalchemy import update

from ..models.transaction import Transaction


def claim_transaction(db, user_id, transaction_id, *, legacy_only=False):
    """Hold the row until the caller commits/rolls back; never commit here.

    A conditional no-op UPDATE also acquires a write lock on SQLite, where
    SELECT FOR UPDATE is ignored. PostgreSQL rechecks the legacy predicate
    after waiting for another writer. Refresh the ORM value after the claim.
    Cash writers lock workspace(s) first; callers claiming several rows must
    use sorted IDs. Legacy callers must never acquire a workspace afterwards.
    """
    statement = update(Transaction).where(
        Transaction.id == transaction_id, Transaction.user_id == user_id
    )
    if legacy_only:
        statement = statement.where(Transaction.workspace_id.is_(None), Transaction.migrated_journal_id.is_(None))
    claimed = db.execute(
        statement.values(id=Transaction.id),
        execution_options={"synchronize_session": False},
    )
    if not claimed.rowcount:
        return None
    return (
        db.query(Transaction)
        .filter_by(id=transaction_id, user_id=user_id)
        .populate_existing()
        .one()
    )
