"""create system_settings table

Revision ID: c1a2b3c4d5e6
Revises: 90d8e2c6954d
Create Date: 2026-08-04 02:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1a2b3c4d5e6'
down_revision: Union[str, None] = '90d8e2c6954d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()
    if 'system_settings' not in tables:
        system_settings = op.create_table(
            'system_settings',
            sa.Column('key', sa.String(length=50), nullable=False),
            sa.Column('value', sa.String(length=100), nullable=False),
            sa.PrimaryKeyConstraint('key')
        )
        op.bulk_insert(
            system_settings,
            [
                {'key': 'monitoring_mode', 'value': 'demo'},
                {'key': 'simulation_active', 'value': 'false'}
            ]
        )



def downgrade() -> None:
    op.drop_table('system_settings')
