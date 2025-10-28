# Moderation System Documentation

## Overview
The Question My Faith app includes a comprehensive moderation system that allows moderators and admins to review, approve, deny, or edit Q&A pairs before they become part of the training data for the AI model.

## Features

### 1. Moderation Queue
- **Automatic Population**: All new Q&A pairs are automatically added to the moderation queue
- **Crisis Detection**: Items flagged by crisis detection are prioritized
- **Status Tracking**: Each item has a status (pending, accepted, denied, edited)

### 2. Moderation Interface
- **Dual View Modes**: Table view for quick scanning, Card view for detailed review
- **Status Dashboard**: Real-time counts of pending, accepted, edited, and denied items
- **Role-Based Access**: Only moderators and admins can access the moderation page

### 3. Moderation Actions
- **Accept**: Approve the Q&A pair as-is
- **Deny**: Reject the Q&A pair
- **Edit**: Modify the assistant's answer before accepting
- **Re-edit**: Modify previously edited content

### 4. Model Retraining
- **Automatic Trigger**: When 20 items are accepted/edited, the system prepares for model retraining
- **Training Data Export**: Creates JSONL format suitable for OpenAI fine-tuning
- **Quality Control**: Only approved content is used for retraining

## Database Schema

### Tables Used
- `qna`: Stores user questions and assistant answers
- `moderation_queue`: Tracks moderation status and actions
- `profiles`: Contains user roles (moderator/admin)
- `qna_accepted`: View of approved Q&A pairs for training

### Key Fields
```sql
moderation_queue:
- id: Primary key
- qna_id: Reference to Q&A pair
- status: pending/accepted/denied/edited
- moderator_id: Who made the decision
- edited_answer: Modified answer (if edited)
- moderator_notes: Optional notes
- decided_at: When decision was made
- auto_flags: Crisis detection flags
- source: How the item was flagged
```

## User Interface

### Moderation Page (`/moderation`)
- **Access Control**: Requires moderator or admin role
- **Status Summary**: Dashboard showing counts by status
- **View Toggle**: Switch between table and card layouts
- **Action Buttons**: Accept, Deny, Edit for each item
- **Real-time Updates**: Refresh button to get latest data

### Home Page Integration
- **Moderation Button**: Appears for moderators/admins using Valeri Consulting secondary color (#DA734E)
- **Role Detection**: Automatically shows/hides based on user role

## API Endpoints

### Moderation Actions (`/api/moderation/[action]`)
- **POST**: Accept, deny, or edit Q&A pairs
- **Authentication**: Requires moderator/admin role
- **Parameters**: qnaId, editedAnswer (optional), moderatorNotes (optional)

## Scripts

### 1. Populate Moderation Queue (`scripts/populate-moderation-queue.js`)
```bash
node scripts/populate-moderation-queue.js
```
- Backfills existing Q&A pairs into moderation queue
- Avoids duplicates
- Shows summary statistics

### 2. Trigger Model Retraining (`scripts/trigger-model-retraining.js`)
```bash
node scripts/trigger-model-retraining.js
```
- Checks if 20+ items are accepted
- Exports training data in JSONL format
- Prepares for OpenAI fine-tuning

## Workflow

### 1. Content Creation
1. User asks question via chat interface
2. AI generates response
3. Q&A pair automatically added to moderation queue
4. Crisis detection flags are applied if applicable

### 2. Moderation Process
1. Moderator/Admin accesses `/moderation` page
2. Reviews Q&A pairs in table or card view
3. Takes action: Accept, Deny, or Edit
4. System updates status and tracks moderator

### 3. Model Retraining
1. When 20 items reach "accepted" or "edited" status
2. System exports approved Q&A pairs
3. Creates JSONL file for OpenAI fine-tuning
4. Ready for model retraining process

## Security & Access Control

### Row Level Security (RLS)
- Only moderators/admins can access moderation queue
- Users can only see their own Q&A pairs
- Anonymous sessions are properly handled

### Role-Based Access
- **User**: Can ask questions, view own profile
- **Moderator**: Can moderate content, access moderation page
- **Admin**: Full access including moderation and admin functions

## Configuration

### Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for scripts
- `OPENAI_API_KEY`: For AI responses and future fine-tuning

### Database Setup
- Run migrations in order: `000_qmf_core.sql`, `001_add_crisis_fields.sql`, `002_fix_profiles_rls.sql`
- Ensure proper RLS policies are in place
- Set up user roles in profiles table

## Monitoring & Analytics

### Status Tracking
- Real-time counts of moderation queue status
- Moderator activity tracking
- Decision timestamps

### Quality Metrics
- Acceptance rate
- Edit frequency
- Response time to moderation

## Future Enhancements

### Planned Features
1. **Bulk Actions**: Select multiple items for batch processing
2. **Moderator Notes**: Enhanced note-taking system
3. **Auto-moderation**: ML-based pre-filtering
4. **Analytics Dashboard**: Detailed moderation metrics
5. **Notification System**: Alerts for new items requiring review

### Integration Opportunities
1. **OpenAI Fine-tuning**: Direct API integration for model retraining
2. **Slack/Discord**: Notifications for moderation team
3. **Advanced Analytics**: Detailed reporting and insights

## Troubleshooting

### Common Issues
1. **Access Denied**: Check user role in profiles table
2. **Empty Queue**: Run populate script to backfill existing data
3. **RLS Errors**: Verify policies are correctly applied
4. **Missing Items**: Check if Q&A pairs have assistant_answer populated

### Debug Steps
1. Check user authentication status
2. Verify role in profiles table
3. Test RLS policies with different user types
4. Review console logs for API errors

## Support

For technical support or questions about the moderation system:
1. Check this documentation
2. Review console logs
3. Test with different user roles
4. Verify database permissions and RLS policies
