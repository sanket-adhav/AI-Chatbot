"""add user profile fields

Revision ID: 28f5cc0bd6f0
Revises: 4cbd52e84c29
Create Date: 2026-02-21 12:14:45.662289

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '28f5cc0bd6f0'
down_revision: Union[str, None] = '4cbd52e84c29'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('avatar_url', sa.String(), nullable=True))
    op.add_column('users', sa.Column('system_prompt', sa.String(), nullable=True))
    op.add_column('users', sa.Column('theme_preference', sa.String(length=50), server_default='dark', nullable=False))


def downgrade() -> None:
    op.drop_column('users', 'theme_preference')
    op.drop_column('users', 'system_prompt')
    op.drop_column('users', 'avatar_url')
