# Vapi Integration Guide for IcePhone External Tools

## Overview

This guide walks you through integrating IcePhone's external tools with your Vapi voice assistants. The tools allow your voice agents to interact with IcePhone's CRM system in real-time during conversations.

## Available Tools

IcePhone provides 4 powerful tools for voice agents:

1. **updateLeadScore** - Update lead scoring based on conversation outcomes
2. **updateLeadNotes** - Add structured notes to lead records
3. **sendFollowUpEmail** - Send professional follow-up emails
4. **searchCallTranscripts** - Search previous call transcripts for context

## Tool Endpoint

**Base URL**: `https://your-domain.com/api/vapi/tools`
**Methods**: GET (health check), POST (tool execution)

## Tool Configurations for Vapi

### 1. Update Lead Score Tool

```json
{
  "type": "function",
  "name": "updateLeadScore",
  "parameters": {
    "type": "object",
    "properties": {
      "leadId": {
        "type": "string",
        "description": "The ID of the lead to update"
      },
      "scoreChange": {
        "type": "number",
        "minimum": -100,
        "maximum": 100,
        "description": "Score change amount (positive to increase, negative to decrease)"
      },
      "reason": {
        "type": "string",
        "description": "Reason for the score change"
      }
    },
    "required": ["leadId", "scoreChange"]
  },
  "description": "Updates a lead's score based on conversation outcomes. Use positive values for good interactions, negative for poor ones.",
  "server": {
    "url": "https://your-domain.com/api/vapi/tools"
  },
  "messages": [
    {
      "type": "request-start",
      "content": "Let me update your lead score based on our conversation..."
    },
    {
      "type": "request-complete",
      "content": "I've updated the lead score successfully."
    },
    {
      "type": "request-failed",
      "content": "I had trouble updating the lead score, but I'll make a note of this conversation."
    }
  ],
  "async": false
}
```

### 2. Update Lead Notes Tool

```json
{
  "type": "function",
  "name": "updateLeadNotes",
  "parameters": {
    "type": "object",
    "properties": {
      "leadId": {
        "type": "string",
        "description": "The ID of the lead to update"
      },
      "notes": {
        "type": "string",
        "description": "Notes to add about the conversation or lead"
      },
      "append": {
        "type": "boolean",
        "description": "Whether to append to existing notes (true) or replace them (false)",
        "default": true
      }
    },
    "required": ["leadId", "notes"]
  },
  "description": "Adds notes to a lead record with automatic timestamps. Use this to capture important conversation details, objections, interests, or next steps.",
  "server": {
    "url": "https://your-domain.com/api/vapi/tools"
  },
  "messages": [
    {
      "type": "request-start",
      "content": "I'm making a note of our conversation..."
    },
    {
      "type": "request-complete",
      "content": "I've added notes to your record."
    },
    {
      "type": "request-failed",
      "content": "I couldn't update the notes right now, but I'll remember the key points from our conversation."
    }
  ],
  "async": false
}
```

### 3. Send Follow-Up Email Tool

```json
{
  "type": "function",
  "name": "sendFollowUpEmail",
  "parameters": {
    "type": "object",
    "properties": {
      "leadId": {
        "type": "string",
        "description": "The ID of the lead to send email to"
      },
      "subject": {
        "type": "string",
        "description": "Email subject line"
      },
      "content": {
        "type": "string",
        "description": "Email content/message"
      },
      "templateType": {
        "type": "string",
        "enum": ["follow_up", "appointment_reminder", "custom"],
        "description": "Type of email template to use",
        "default": "follow_up"
      }
    },
    "required": ["leadId", "subject", "content"]
  },
  "description": "Sends a professional follow-up email to a lead. The email will be formatted with IcePhone branding and styled professionally.",
  "server": {
    "url": "https://your-domain.com/api/vapi/tools"
  },
  "messages": [
    {
      "type": "request-start",
      "content": "I'm sending a follow-up email for you..."
    },
    {
      "type": "request-complete",
      "content": "I've sent the follow-up email successfully."
    },
    {
      "type": "request-failed",
      "content": "I couldn't send the email right now, but I'll make sure to follow up through other means."
    },
    {
      "type": "request-response-delayed",
      "content": "The email is taking a moment to send...",
      "timingMilliseconds": 3000
    }
  ],
  "async": false
}
```

### 4. Search Call Transcripts Tool

```json
{
  "type": "function",
  "name": "searchCallTranscripts",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search term to look for in call transcripts"
      },
      "leadId": {
        "type": "string",
        "description": "Optional: limit search to specific lead's calls"
      },
      "limit": {
        "type": "number",
        "minimum": 1,
        "maximum": 10,
        "description": "Maximum number of results to return",
        "default": 5
      }
    },
    "required": ["query"]
  },
  "description": "Searches previous call transcripts to find relevant conversations. Useful for referencing past discussions, objections, or commitments.",
  "server": {
    "url": "https://your-domain.com/api/vapi/tools"
  },
  "messages": [
    {
      "type": "request-start",
      "content": "Let me search our previous conversations..."
    },
    {
      "type": "request-complete",
      "content": "I found some relevant information from our past calls."
    },
    {
      "type": "request-failed",
      "content": "I couldn't search the call history right now, but I can still help with your current needs."
    }
  ],
  "async": false
}
```

## Setting Up in Vapi Dashboard

### Step 1: Create or Edit Assistant

1. Go to your Vapi dashboard
2. Create a new assistant or edit an existing one
3. Navigate to the "Tools" section

### Step 2: Add Tools Configuration

1. Add each tool configuration from above to your assistant's tools array
2. Replace `https://your-domain.com` with your actual IcePhone deployment URL
3. Save the assistant configuration

### Step 3: Test the Integration

1. Make a test call to your assistant
2. Try using natural language that would trigger the tools:
   - "This lead seems very interested, can you update their score?"
   - "Make a note that they want to think about it"
   - "Send them a follow-up email about our pricing"
   - "What did we discuss in our last call?"

## Best Practices

### Tool Usage Guidelines

1. **Be Contextual**: Only trigger tools when they add value to the conversation
2. **Handle Failures Gracefully**: Always have fallback responses when tools fail
3. **Keep It Natural**: Don't announce every tool action - integrate smoothly into conversation
4. **Validate Data**: Ensure lead IDs and parameters are valid before calling tools

### Prompt Engineering Tips

Include these instructions in your assistant's system prompt:

```
You are a professional sales assistant with access to CRM tools. Use these tools naturally during conversations:

- Update lead scores based on interest level and conversation quality
- Take detailed notes about objections, interests, and next steps
- Send follow-up emails when appropriate
- Reference previous conversations to build rapport

Only use tools when they genuinely improve the customer experience. Handle tool failures gracefully without disrupting the conversation flow.
```

### Security Considerations

1. **User Context**: All tools automatically scope to the correct user - no cross-user data access
2. **Input Validation**: All parameters are validated before processing
3. **Error Handling**: Failed tools don't expose sensitive information
4. **Rate Limiting**: Consider implementing rate limiting for production use

## Troubleshooting

### Common Issues

1. **Tool Not Found**: Ensure tool names match exactly (case-sensitive)
2. **Authentication Errors**: Check that voice sessions are properly linked to users
3. **Parameter Validation**: Verify all required parameters are provided with correct types
4. **Network Issues**: Ensure your IcePhone instance is accessible from Vapi's servers

### Testing Tools

Use the health check endpoint to verify tools are working:

```bash
curl https://your-domain.com/api/vapi/tools
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "supportedTools": [
    "updateLeadScore",
    "updateLeadNotes",
    "sendFollowUpEmail",
    "searchCallTranscripts"
  ]
}
```

## Advanced Usage

### Chaining Tools

Tools can be used in sequence during a single conversation:

1. Search transcripts to understand context
2. Update lead notes with new information
3. Update lead score based on conversation outcome
4. Send follow-up email with next steps

### Custom Workflows

Combine tools with your business logic:

- Auto-qualify leads based on conversation patterns
- Trigger different email templates based on lead behavior
- Create detailed conversation summaries for sales teams
- Build lead scoring algorithms based on voice interactions

## Support

For technical support with the tools integration:

1. Check the logs in your IcePhone instance
2. Verify tool configurations match the schemas exactly
3. Test individual tools with sample data
4. Contact support with specific error messages and request details