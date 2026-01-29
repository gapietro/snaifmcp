/**
 * Example: Case Summarizer Skill
 *
 * This skill summarizes customer service cases including comments,
 * related incidents, and recommended actions.
 */

var CaseSummarizerSkill = Class.create();
CaseSummarizerSkill.prototype = {

    initialize: function() {
        this.controller = new sn_genai.GenAIController();
    },

    /**
     * Execute the case summarization skill
     * @param {Object} input - Input parameters
     * @param {string} input.case_sys_id - Sys ID of the case to summarize
     * @param {string[]} [input.focus_areas] - Optional areas to emphasize
     * @returns {Object} Summary result
     */
    execute: function(input) {
        // Validate input
        if (!this._validateInput(input)) {
            return {
                status: 'error',
                error: 'Invalid input',
                details: this.validationErrors
            };
        }

        // Gather context
        var context = this._gatherContext(input);
        if (context.error) {
            return { status: 'error', error: context.error };
        }

        // Build and execute prompt
        var prompt = this._buildPrompt(context, input.focus_areas);

        try {
            var response = this.controller.executePrompt(prompt);
            return this._processOutput(response);
        } catch (e) {
            gs.error('CaseSummarizerSkill error: ' + e.message);
            return {
                status: 'error',
                error: 'Failed to generate summary',
                details: e.message
            };
        }
    },

    _validateInput: function(input) {
        this.validationErrors = [];

        if (!input.case_sys_id) {
            this.validationErrors.push('case_sys_id is required');
        }

        if (input.focus_areas && !Array.isArray(input.focus_areas)) {
            this.validationErrors.push('focus_areas must be an array');
        }

        return this.validationErrors.length === 0;
    },

    _gatherContext: function(input) {
        // Get case record
        var caseGR = new GlideRecord('sn_customerservice_case');
        if (!caseGR.get(input.case_sys_id)) {
            return { error: 'Case not found: ' + input.case_sys_id };
        }

        return {
            case: {
                number: caseGR.number.toString(),
                short_description: caseGR.short_description.toString(),
                description: caseGR.description.toString(),
                state: caseGR.state.getDisplayValue(),
                priority: caseGR.priority.getDisplayValue(),
                created: caseGR.sys_created_on.getDisplayValue(),
                account: caseGR.account.getDisplayValue(),
                contact: caseGR.contact.getDisplayValue()
            },
            comments: this._getComments(input.case_sys_id),
            related_incidents: this._getRelatedIncidents(caseGR)
        };
    },

    _getComments: function(case_sys_id) {
        var comments = [];
        var commentGR = new GlideRecord('sys_journal_field');
        commentGR.addQuery('element_id', case_sys_id);
        commentGR.addQuery('element', 'comments');
        commentGR.orderByDesc('sys_created_on');
        commentGR.setLimit(20);
        commentGR.query();

        while (commentGR.next()) {
            comments.push({
                created: commentGR.sys_created_on.getDisplayValue(),
                author: commentGR.sys_created_by.toString(),
                value: commentGR.value.toString()
            });
        }

        return comments;
    },

    _getRelatedIncidents: function(caseGR) {
        var incidents = [];
        // Implementation depends on relationship setup
        // This is a simplified example
        return incidents;
    },

    _buildPrompt: function(context, focusAreas) {
        var focus = focusAreas && focusAreas.length > 0
            ? focusAreas.join(', ')
            : 'timeline, key issues, resolution status';

        return {
            system: this.SYSTEM_PROMPT,
            user: this._formatUserPrompt(context, focus)
        };
    },

    _formatUserPrompt: function(context, focus) {
        var commentsText = context.comments.length > 0
            ? context.comments.map(function(c) {
                return '- [' + c.created + '] ' + c.author + ': ' + c.value;
            }).join('\n')
            : 'No comments recorded.';

        return 'Summarize the following customer service case:\n\n' +
            '**Case Details:**\n' +
            '- Number: ' + context.case.number + '\n' +
            '- Short Description: ' + context.case.short_description + '\n' +
            '- State: ' + context.case.state + '\n' +
            '- Priority: ' + context.case.priority + '\n' +
            '- Created: ' + context.case.created + '\n' +
            '- Account: ' + context.case.account + '\n' +
            '- Contact: ' + context.case.contact + '\n\n' +
            '**Description:**\n' + context.case.description + '\n\n' +
            '**Comments/Updates:**\n' + commentsText + '\n\n' +
            '**Focus areas:** ' + focus + '\n\n' +
            'Provide:\n' +
            '1. A brief summary (2-3 sentences)\n' +
            '2. Key points as bullet list\n' +
            '3. Current status assessment\n' +
            '4. Recommended next actions';
    },

    _processOutput: function(response) {
        // Parse the response into structured output
        // This is a simplified parser - enhance based on actual output format

        var sections = response.split(/#{1,3}\s*/);

        return {
            status: 'success',
            summary: response,
            parsed: {
                brief_summary: this._extractSection(response, 'summary'),
                key_points: this._extractBulletPoints(response, 'key points'),
                status_assessment: this._extractSection(response, 'status'),
                recommended_actions: this._extractBulletPoints(response, 'recommended')
            }
        };
    },

    _extractSection: function(text, sectionKeyword) {
        // Simple extraction - enhance for production
        var lines = text.split('\n');
        var inSection = false;
        var content = [];

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].toLowerCase();
            if (line.includes(sectionKeyword)) {
                inSection = true;
                continue;
            }
            if (inSection) {
                if (line.match(/^[#\*\d]/)) break;
                if (lines[i].trim()) content.push(lines[i].trim());
            }
        }

        return content.join(' ');
    },

    _extractBulletPoints: function(text, sectionKeyword) {
        var points = [];
        var lines = text.split('\n');
        var inSection = false;

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (line.toLowerCase().includes(sectionKeyword)) {
                inSection = true;
                continue;
            }
            if (inSection) {
                if (line.match(/^[\-\*\d]\s*/)) {
                    points.push(line.replace(/^[\-\*\d\.\s]+/, '').trim());
                } else if (line.match(/^#/) && points.length > 0) {
                    break;
                }
            }
        }

        return points;
    },

    SYSTEM_PROMPT: 'You are a ServiceNow case analyst specializing in customer service. ' +
        'Your role is to provide clear, actionable summaries of support cases.\n\n' +
        'Guidelines:\n' +
        '- Be concise but comprehensive\n' +
        '- Highlight critical information and blockers\n' +
        '- Identify patterns across comments\n' +
        '- Suggest concrete next steps\n' +
        '- Use professional, neutral language\n' +
        '- If information is missing, note it as "Not specified"',

    type: 'CaseSummarizerSkill'
};

// Skill Manifest
var CaseSummarizerSkillManifest = {
    skill_id: 'case_summarizer',
    name: 'Case Summarizer',
    description: 'Summarizes customer service cases with comments and recommended actions',
    version: '1.0.0',
    category: 'summarization',
    input_schema: {
        type: 'object',
        required: ['case_sys_id'],
        properties: {
            case_sys_id: {
                type: 'string',
                description: 'Sys ID of the case to summarize'
            },
            focus_areas: {
                type: 'array',
                items: { type: 'string' },
                description: 'Areas to emphasize (e.g., timeline, resolution, escalation)'
            }
        }
    },
    output_schema: {
        type: 'object',
        properties: {
            status: { type: 'string', enum: ['success', 'error'] },
            summary: { type: 'string' },
            parsed: {
                type: 'object',
                properties: {
                    brief_summary: { type: 'string' },
                    key_points: { type: 'array', items: { type: 'string' } },
                    status_assessment: { type: 'string' },
                    recommended_actions: { type: 'array', items: { type: 'string' } }
                }
            }
        }
    },
    configuration: {
        model_preference: 'gpt-4',
        temperature: 0.3,
        max_tokens: 1000
    }
};
