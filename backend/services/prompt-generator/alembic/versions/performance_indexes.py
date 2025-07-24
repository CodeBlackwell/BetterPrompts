"""Add performance optimization indexes

Revision ID: performance_indexes_001
Revises: 
Create Date: 2025-01-23 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'performance_indexes_001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add performance optimization indexes for prompt-generator tables"""
    
    # Create indexes for prompt_feedback table
    op.create_index(
        'idx_prompt_feedback_user_rating',
        'prompt_feedback',
        ['user_id', 'rating'],
        schema='prompts',
        postgresql_concurrently=True,
        if_not_exists=True
    )
    
    op.create_index(
        'idx_prompt_feedback_session_created',
        'prompt_feedback',
        ['session_id', 'created_at'],
        schema='prompts',
        postgresql_concurrently=True,
        if_not_exists=True
    )
    
    op.create_index(
        'idx_prompt_feedback_type_created',
        'prompt_feedback',
        ['feedback_type', 'created_at'],
        schema='prompts',
        postgresql_concurrently=True,
        if_not_exists=True
    )
    
    op.create_index(
        'idx_prompt_feedback_technique_ratings_gin',
        'prompt_feedback',
        ['technique_ratings'],
        schema='prompts',
        postgresql_using='gin',
        postgresql_concurrently=True,
        if_not_exists=True
    )
    
    # Create indexes for technique_effectiveness_metrics table
    op.create_index(
        'idx_tem_effectiveness_score',
        'technique_effectiveness_metrics',
        ['effectiveness_score'],
        schema='analytics',
        postgresql_concurrently=True,
        if_not_exists=True
    )
    
    op.create_index(
        'idx_tem_total_uses',
        'technique_effectiveness_metrics',
        ['total_uses'],
        schema='analytics',
        postgresql_concurrently=True,
        if_not_exists=True
    )
    
    op.create_index(
        'idx_tem_technique_period',
        'technique_effectiveness_metrics',
        ['technique', 'period_start', 'period_end'],
        schema='analytics',
        postgresql_concurrently=True,
        if_not_exists=True
    )
    
    # Create indexes for technique_effectiveness_records table
    op.create_index(
        'idx_ter_technique_intent_complexity',
        'technique_effectiveness_records',
        ['technique_id', 'intent_type', 'complexity_level'],
        schema='analytics',
        postgresql_concurrently=True,
        if_not_exists=True
    )
    
    # Create indexes for user_feedback table
    op.create_index(
        'idx_user_feedback_effectiveness_record_id_fk',
        'user_feedback',
        ['effectiveness_record_id'],
        schema='analytics',
        postgresql_concurrently=True,
        if_not_exists=True
    )


def downgrade() -> None:
    """Remove performance optimization indexes"""
    
    # Drop indexes from prompt_feedback table
    op.drop_index('idx_prompt_feedback_user_rating', 'prompt_feedback', schema='prompts')
    op.drop_index('idx_prompt_feedback_session_created', 'prompt_feedback', schema='prompts')
    op.drop_index('idx_prompt_feedback_type_created', 'prompt_feedback', schema='prompts')
    op.drop_index('idx_prompt_feedback_technique_ratings_gin', 'prompt_feedback', schema='prompts')
    
    # Drop indexes from technique_effectiveness_metrics table
    op.drop_index('idx_tem_effectiveness_score', 'technique_effectiveness_metrics', schema='analytics')
    op.drop_index('idx_tem_total_uses', 'technique_effectiveness_metrics', schema='analytics')
    op.drop_index('idx_tem_technique_period', 'technique_effectiveness_metrics', schema='analytics')
    
    # Drop indexes from technique_effectiveness_records table
    op.drop_index('idx_ter_technique_intent_complexity', 'technique_effectiveness_records', schema='analytics')
    
    # Drop indexes from user_feedback table
    op.drop_index('idx_user_feedback_effectiveness_record_id_fk', 'user_feedback', schema='analytics')