<template>
  <CroutonFormActionButton
    v-if="action === 'delete'"
    :action="action"
    :collection="collection"
    :items="items"
    :loading="loading"
    @click="handleSubmit"
  />

  <UForm
    v-else
    :schema="schema"
    :state="state"
    @submit="handleSubmit"
    @error="handleValidationError"
  >
    <CroutonFormLayout :tabs="tabs" :navigation-items="navigationItems" :tab-errors="tabErrorCounts" v-model="activeSection">
      <template #main="{ activeSection }">
      <div v-show="!tabs || activeSection === 'basic'" class="flex flex-col gap-4 p-1">
        <UFormField
          label="Source Type"
          name="sourceType"
          description="Select the platform to integrate with"
          required
          class="not-last:pb-4"
        >
          <USelect
            v-model="state.sourceType"
            :items="sourceTypeOptions"
            placeholder="Select a source type..."
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Configuration Name"
          name="name"
          description="A friendly name to identify this configuration (e.g., 'Main Figma Project')"
          required
          class="not-last:pb-4"
        >
          <UInput
            v-model="state.name"
            placeholder="e.g., Main Figma Project"
            class="w-full"
            size="xl"
          />
        </UFormField>
      </div>

      <div v-show="(!tabs || activeSection === 'email') && isFigmaSource" class="flex flex-col gap-4 p-1">
        <div class="mb-2 p-3 sm:p-4 bg-muted/50 rounded-lg">
          <p class="text-xs sm:text-sm text-muted-foreground">
            Figma uses email forwarding for comment notifications. Configure a unique email address for this project.
          </p>
        </div>
        <UFormField
          label="Email Address"
          name="emailAddress"
          description="Full email address (e.g., comments-team1@yourdomain.com)"
          class="not-last:pb-4"
        >
          <UInput
            v-model="state.emailAddress"
            type="email"
            placeholder="comments-team1@yourdomain.com"
            class="w-full"
            size="xl"
          />
        </UFormField>
        <UFormField
          label="Email Slug"
          name="emailSlug"
          description="Unique identifier for this team (used in email routing)"
          class="not-last:pb-4"
        >
          <UInput
            v-model="state.emailSlug"
            placeholder="team1"
            class="w-full"
            size="xl"
          />
        </UFormField>
      </div>

      <div v-show="(!tabs || activeSection === 'webhook') && isSlackSource" class="flex flex-col gap-4 p-1">
        <div class="mb-2 p-3 sm:p-4 bg-muted/50 rounded-lg">
          <p class="text-xs sm:text-sm text-muted-foreground">
            Configure Slack webhook integration. You'll receive this webhook URL after setting up your Slack app.
          </p>
        </div>
        <UFormField
          label="Webhook URL"
          name="webhookUrl"
          description="Slack webhook endpoint (provided by Slack app configuration)"
          class="not-last:pb-4"
        >
          <UInput
            v-model="state.webhookUrl"
            type="url"
            placeholder="https://hooks.slack.com/services/..."
            class="w-full"
            size="xl"
          />
        </UFormField>
        <UFormField
          label="Webhook Secret"
          name="webhookSecret"
          description="Signing secret for webhook verification (from Slack app settings)"
          class="not-last:pb-4"
        >
          <UInput
            v-model="state.webhookSecret"
            type="password"
            placeholder="Enter signing secret..."
            class="w-full"
            size="xl"
          />
        </UFormField>
      </div>

      <div v-show="!tabs || activeSection === 'credentials'" class="flex flex-col gap-4 p-1">
        <!-- Slack OAuth Section -->
        <div v-if="isSlackSource" class="space-y-4">
          <div class="mb-2 p-3 sm:p-4 bg-primary/5 rounded-lg border border-primary/20">
            <div class="flex items-start gap-3">
              <div class="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                <svg class="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5zm0 1c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5zm-5 0c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5zm0 1c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5z"/>
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <h4 class="text-sm font-semibold text-foreground mb-1">
                  Connect with Slack (Recommended)
                </h4>
                <p class="text-xs text-muted-foreground mb-3">
                  Authorize Discubot to access your Slack workspace. This will automatically configure your bot token and workspace settings.
                </p>

                <!-- OAuth Connection Status -->
                <div v-if="hasOAuthConnection" class="space-y-2">
                  <div class="flex items-center gap-2 text-xs">
                    <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-success/10 text-success font-medium">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      Connected via OAuth
                    </span>
                  </div>
                  <p class="text-xs text-muted-foreground">
                    <strong class="text-foreground">Workspace:</strong> {{ oauthWorkspaceName }}
                  </p>
                  <UButton
                    type="button"
                    @click.prevent="openOAuthPopup"
                    color="neutral"
                    variant="soft"
                    size="sm"
                  >
                    Reconnect Workspace
                  </UButton>
                </div>

                <!-- OAuth Connect Button -->
                <UButton
                  v-else
                  type="button"
                  @click.prevent="openOAuthPopup"
                  color="primary"
                  size="md"
                >
                  <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5zm0 1c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5zm-5 0c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5zm0 1c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5z"/>
                  </svg>
                  Connect with Slack
                </UButton>
              </div>
            </div>
          </div>

          <!-- Divider with "OR" -->
          <div class="relative">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-border"></div>
            </div>
            <div class="relative flex justify-center text-xs">
              <span class="px-2 bg-background text-muted-foreground">OR</span>
            </div>
          </div>
        </div>

        <UFormField
          :label="state.sourceType === 'figma' ? 'Figma API Token' : 'Slack Bot Token'"
          name="apiToken"
          :description="state.sourceType === 'figma' ? 'Personal access token from Figma account settings' : isSlackSource && !hasOAuthConnection ? 'Manually enter bot token (xoxb-...) or use OAuth above' : 'Bot User OAuth Token (starts with xoxb-)'"
          :required="state.sourceType === 'figma' || (state.sourceType === 'slack' && !hasOAuthConnection)"
          class="not-last:pb-4"
        >
          <UInput
            v-model="state.apiToken"
            type="password"
            :placeholder="state.sourceType === 'figma' ? 'figd_...' : 'xoxb-...'"
            :disabled="isSlackSource && hasOAuthConnection"
            class="w-full font-mono"
            size="xl"
          />
          <template v-if="isSlackSource && hasOAuthConnection" #hint>
            <p class="text-xs text-muted-foreground mt-1">
              Token is managed via OAuth. Click "Reconnect Workspace" above to update.
            </p>
          </template>
        </UFormField>
        <UFormField
          label="Notion Integration Token"
          name="notionToken"
          required
          class="not-last:pb-4"
        >
          <template #description>
            <div class="space-y-1">
              <p>Create at <a href="https://www.notion.so/my-integrations" target="_blank" class="text-primary hover:underline">notion.so/my-integrations</a></p>
              <p class="text-xs">Don't forget to share your database with the integration!</p>
            </div>
          </template>
          <UInput
            v-model="state.notionToken"
            type="password"
            placeholder="ntn_..."
            class="w-full font-mono"
            size="xl"
          />
        </UFormField>
        <UFormField
          label="Claude API Key (Optional)"
          name="anthropicApiKey"
          description="Leave empty to use global API key. Provide to override per-configuration."
          class="not-last:pb-4"
        >
          <UInput
            v-model="state.anthropicApiKey"
            type="password"
            placeholder="sk-ant-..."
            class="w-full font-mono"
            size="xl"
          />
        </UFormField>
      </div>

      <div v-show="!tabs || activeSection === 'notion'" class="flex flex-col gap-4 p-1">
        <UFormField
          label="Notion Database ID"
          name="notionDatabaseId"
          required
          class="not-last:pb-4"
        >
          <template #description>
            <p class="text-sm">Copy from your database URL: <code class="text-xs">notion.so/workspace/<span class="text-primary">abc123def456...</span>?v=...</code></p>
          </template>
          <UInput
            v-model="state.notionDatabaseId"
            placeholder="abc123def456789..."
            class="w-full font-mono"
            size="xl"
          />
        </UFormField>

        <!-- Fetch Schema Button -->
        <div v-if="state.notionDatabaseId && state.notionToken" class="p-4 bg-muted/30 rounded-lg border border-gray-200 dark:border-gray-800">
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1">
              <h4 class="text-sm font-semibold mb-1">Auto-Generate Field Mappings</h4>
              <p class="text-xs text-muted-foreground">
                Fetch your Notion database schema and automatically map AI fields to your database properties.
              </p>
            </div>
            <UButton
              color="primary"
              variant="outline"
              icon="i-lucide-download"
              :label="fetchingSchema ? 'Fetching...' : 'Fetch Schema'"
              :disabled="fetchingSchema"
              :loading="fetchingSchema"
              @click="fetchNotionSchema"
              size="sm"
            />
          </div>
          <div v-if="schemaFetchError" class="mt-3">
            <UAlert
              color="error"
              variant="soft"
              :title="schemaFetchError"
              :close-button="{ icon: 'i-lucide-x', color: 'neutral', variant: 'link' }"
              @close="schemaFetchError = null"
            />
          </div>
          <div v-if="fetchedSchema" class="mt-3">
            <UAlert
              color="success"
              variant="soft"
              :title="`Schema fetched: ${fetchedSchema.databaseTitle}`"
              :description="`Found ${Object.keys(fetchedSchema.properties).length} properties. Field mappings generated below.`"
            />
          </div>
        </div>

        <!-- Field Mapping Form -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h4 class="text-sm font-semibold">Field Mappings</h4>
            <UButton
              v-if="fetchedSchema"
              color="neutral"
              variant="ghost"
              icon="i-lucide-refresh-cw"
              label="Reset to Auto-Generated"
              size="xs"
              @click="resetToAutoGenerated"
            />
          </div>
          <p class="text-xs text-muted-foreground -mt-2">
            Map AI-detected fields to your Notion database properties. Fetch schema above for auto-suggestions.
          </p>

          <!-- Priority Mapping -->
          <div class="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 space-y-3">
            <div class="flex items-center gap-2">
              <h5 class="text-sm font-medium">Priority</h5>
              <UBadge color="neutral" variant="subtle" size="xs">AI Field</UBadge>
            </div>

            <UFormField label="Notion Property" name="notionFieldMapping.priority.notionProperty" size="sm">
              <USelectMenu
                v-model="fieldMappings.priority.notionProperty"
                :options="notionPropertyOptions"
                placeholder="Select a property..."
                size="md"
                class="w-full"
              />
            </UFormField>

            <div v-if="fieldMappings.priority.notionProperty" class="flex items-center gap-2 text-xs">
              <span class="text-muted-foreground">Property Type:</span>
              <UBadge
                :color="(getPropertyTypeColor(fieldMappings.priority.propertyType) as any)"
                variant="subtle"
                size="xs"
              >
                {{ fieldMappings.priority.propertyType || 'unknown' }}
              </UBadge>
            </div>

            <!-- Value Mappings for Select Fields -->
            <div v-if="fieldMappings.priority.propertyType === 'select' || fieldMappings.priority.propertyType === 'status'" class="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-800">
              <p class="text-xs font-medium text-muted-foreground">Value Mappings</p>
              <div v-for="aiValue in ['low', 'medium', 'high', 'urgent']" :key="aiValue" class="grid grid-cols-[100px_1fr] gap-2 items-center">
                <span class="text-xs text-muted-foreground">{{ aiValue }}</span>
                <UInput
                  v-model="fieldMappings.priority.valueMap[aiValue]"
                  placeholder="Notion value..."
                  size="sm"
                  class="font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <!-- Type Mapping -->
          <div class="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 space-y-3">
            <div class="flex items-center gap-2">
              <h5 class="text-sm font-medium">Type</h5>
              <UBadge color="neutral" variant="subtle" size="xs">AI Field</UBadge>
            </div>

            <UFormField label="Notion Property" name="notionFieldMapping.type.notionProperty" size="sm">
              <USelectMenu
                v-model="fieldMappings.type.notionProperty"
                :options="notionPropertyOptions"
                placeholder="Select a property..."
                size="md"
                class="w-full"
              />
            </UFormField>

            <div v-if="fieldMappings.type.notionProperty" class="flex items-center gap-2 text-xs">
              <span class="text-muted-foreground">Property Type:</span>
              <UBadge
                :color="(getPropertyTypeColor(fieldMappings.type.propertyType) as any)"
                variant="subtle"
                size="xs"
              >
                {{ fieldMappings.type.propertyType || 'unknown' }}
              </UBadge>
            </div>

            <!-- Value Mappings for Select Fields -->
            <div v-if="fieldMappings.type.propertyType === 'select' || fieldMappings.type.propertyType === 'status'" class="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-800">
              <p class="text-xs font-medium text-muted-foreground">Value Mappings</p>
              <div v-for="aiValue in ['bug', 'feature', 'question', 'improvement']" :key="aiValue" class="grid grid-cols-[100px_1fr] gap-2 items-center">
                <span class="text-xs text-muted-foreground">{{ aiValue }}</span>
                <UInput
                  v-model="fieldMappings.type.valueMap[aiValue]"
                  placeholder="Notion value..."
                  size="sm"
                  class="font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <!-- Assignee Mapping -->
          <div class="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 space-y-3">
            <div class="flex items-center gap-2">
              <h5 class="text-sm font-medium">Assignee</h5>
              <UBadge color="neutral" variant="subtle" size="xs">AI Field</UBadge>
            </div>

            <UFormField label="Notion Property" name="notionFieldMapping.assignee.notionProperty" size="sm">
              <USelectMenu
                v-model="fieldMappings.assignee.notionProperty"
                :options="notionPropertyOptions"
                placeholder="Select a property..."
                size="md"
                class="w-full"
              />
            </UFormField>

            <div v-if="fieldMappings.assignee.notionProperty" class="flex items-center gap-2 text-xs">
              <span class="text-muted-foreground">Property Type:</span>
              <UBadge
                :color="(getPropertyTypeColor(fieldMappings.assignee.propertyType) as any)"
                variant="subtle"
                size="xs"
              >
                {{ fieldMappings.assignee.propertyType || 'unknown' }}
              </UBadge>
            </div>

            <!-- User Mapping Integration Hint -->
            <div v-if="fieldMappings.assignee.propertyType === 'people'" class="pt-2 border-t border-gray-200 dark:border-gray-800">
              <UAlert
                color="info"
                variant="soft"
                title="User Mapping Required"
                description="Assignee fields require user mappings to connect Slack/Figma users to Notion users."
              >
                <template #actions>
                  <UButton
                    :to="`/dashboard/${currentTeam?.id}/discubot/user-mappings`"
                    color="primary"
                    variant="link"
                    label="Manage User Mappings"
                    trailing-icon="i-lucide-arrow-right"
                    size="xs"
                  />
                </template>
              </UAlert>
            </div>
          </div>

          <!-- Advanced JSON Editor (Collapsible) -->
          <UCollapsible>
            <UButton
              label="Advanced: Edit Field Mapping JSON"
              color="neutral"
              variant="ghost"
              size="sm"
              trailing-icon="i-lucide-chevron-down"
              :ui="{
                trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200'
              }"
            />
            <template #content>
              <div class="mt-3">
                <UFormField
                  label="Field Mapping JSON"
                  name="notionFieldMapping"
                  description="Advanced: Manually edit the complete field mapping configuration."
                  class="not-last:pb-4"
                >
                  <UTextarea
                    :model-value="typeof state.notionFieldMapping === 'string' ? state.notionFieldMapping : JSON.stringify(state.notionFieldMapping, null, 2)"
                    @update:model-value="handleJsonUpdate"
                    class="w-full font-mono text-sm"
                    :rows="12"
                    placeholder='{"priority": {"notionProperty": "Priority", "propertyType": "select", "valueMap": {"high": "P1"}}}'
                  />
                </UFormField>
              </div>
            </template>
          </UCollapsible>
        </div>
      </div>

      <div v-show="!tabs || activeSection === 'ai'" class="flex flex-col gap-4 p-1">
        <UFormField
          label="Summary Prompt Template"
          name="aiSummaryPrompt"
          description="Additional instructions added to the base prompt. Leave empty to use default only."
          class="not-last:pb-4"
        >
          <!-- Preset Examples Dropdown -->
          <div class="mb-3 p-3 bg-muted/30 rounded-lg border border-gray-200 dark:border-gray-800">
            <label class="block text-xs font-medium text-muted-foreground mb-2">
              Quick Start: Choose a Preset Template
            </label>
            <USelect
              :model-value="undefined"
              :items="summaryPresets"
              placeholder="Select a preset template..."
              size="md"
              @update:model-value="(value) => insertSummaryPreset(value)"
            />
          </div>

          <UTextarea
            v-model="state.aiSummaryPrompt"
            placeholder="Summarize this discussion focusing on..."
            class="w-full"
            :rows="4"
            size="xl"
          />
          <UCollapsible class="mt-2">
            <UButton
              label="View default base prompt"
              color="neutral"
              variant="ghost"
              size="xs"
              trailing-icon="i-lucide-chevron-down"
              :ui="{
                trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200'
              }"
            />
            <template #content>
              <div class="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-800">
                <pre class="text-xs font-mono whitespace-pre-wrap">Analyze this discussion thread and provide:

1. A concise summary (2-3 sentences)
2. 3-5 key points or decisions
3. Overall sentiment (positive, neutral, or negative)

Discussion:
{discussion messages}

Respond in JSON format:
{
  "summary": "...",
  "keyPoints": ["...", "...", "..."],
  "sentiment": "positive|neutral|negative",
  "confidence": 0.0-1.0
}</pre>
              </div>
            </template>
          </UCollapsible>
        </UFormField>
        <UFormField
          label="Task Detection Prompt"
          name="aiTaskPrompt"
          description="Additional instructions added to the base prompt. Leave empty to use default only."
          class="not-last:pb-4"
        >
          <!-- Preset Examples Dropdown -->
          <div class="mb-3 p-3 bg-muted/30 rounded-lg border border-gray-200 dark:border-gray-800">
            <label class="block text-xs font-medium text-muted-foreground mb-2">
              Quick Start: Choose a Preset Template
            </label>
            <USelect
              :model-value="undefined"
              :items="taskPresets"
              placeholder="Select a preset template..."
              size="md"
              @update:model-value="(value) => insertTaskPreset(value)"
            />
          </div>

          <UTextarea
            v-model="state.aiTaskPrompt"
            placeholder="Extract actionable tasks from..."
            class="w-full"
            :rows="4"
            size="xl"
          />
          <UCollapsible class="mt-2">
            <UButton
              label="View default base prompt"
              color="neutral"
              variant="ghost"
              size="xs"
              trailing-icon="i-lucide-chevron-down"
              :ui="{
                trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200'
              }"
            />
            <template #content>
              <div class="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-800">
                <pre class="text-xs font-mono whitespace-pre-wrap">Analyze this discussion and identify actionable tasks.

Discussion:
{discussion messages}

<span class="text-primary-600 dark:text-primary-400 font-semibold">← Your custom prompt is inserted here</span>

Instructions:
- Identify specific, actionable tasks mentioned or implied
- Extract title, description, and priority for each task
- Determine if there are multiple distinct tasks (isMultiTask: true/false)
- Maximum 5 tasks
- If no clear tasks, return empty array

Respond in JSON format:
{
  "isMultiTask": true|false,
  "tasks": [
    {
      "title": "...",
      "description": "...",
      "priority": "low|medium|high|urgent",
      "assignee": "...",
      "tags": ["..."]
    }
  ],
  "confidence": 0.0-1.0
}</pre>
              </div>
            </template>
          </UCollapsible>
        </UFormField>

        <!-- Preview Final Prompt Button -->
        <div class="mt-6 p-4 bg-muted/30 rounded-lg border border-gray-200 dark:border-gray-800">
          <div class="flex items-center justify-between mb-2">
            <div>
              <h4 class="text-sm font-semibold">Preview Final Prompt</h4>
              <p class="text-xs text-muted-foreground mt-1">
                See exactly what will be sent to Claude
              </p>
            </div>
          </div>
          <UButton
            color="primary"
            variant="outline"
            icon="i-lucide-eye"
            label="Preview Prompts"
            @click="openPromptPreview"
            class="mt-3"
            size="md"
          />
        </div>
      </div>
      </template>

      <template #sidebar>
      <div class="flex flex-col gap-6 p-1">
        <div class="space-y-4">
          <h3 class="text-sm font-semibold">Features</h3>
          <UFormField
            label="Enable AI Summarization"
            name="aiEnabled"
            description="Use Claude to analyze discussions"
          >
            <USwitch v-model="state.aiEnabled" />
          </UFormField>
          <UFormField
            label="Auto-Process Discussions"
            name="autoSync"
            description="Automatically process incoming discussions"
          >
            <USwitch v-model="state.autoSync" />
          </UFormField>
          <UFormField
            label="Post Confirmations"
            name="postConfirmation"
            description="Reply to source when task created"
          >
            <USwitch v-model="state.postConfirmation" />
          </UFormField>
          <UFormField
            label="Enable Email Forwarding"
            name="enableEmailForwarding"
            description="Forward critical emails (verification, password reset) to your email"
          >
            <USwitch v-model="state.enableEmailForwarding" />
          </UFormField>
        </div>

        <USeparator />

        <div class="space-y-4">
          <h3 class="text-sm font-semibold">Status</h3>
          <UFormField
            label="Active"
            name="active"
            description="Enable this configuration"
          >
            <USwitch v-model="state.active" />
          </UFormField>
          <UFormField
            label="Setup Complete"
            name="onboardingComplete"
            description="Mark as fully configured"
          >
            <USwitch v-model="state.onboardingComplete" />
          </UFormField>
        </div>

        <USeparator />

        <div class="space-y-4">
          <h3 class="text-sm font-semibold">Advanced</h3>
          <UFormField
            label="Source Metadata"
            name="sourceMetadata"
            description="Additional configuration data (JSON)"
          >
            <UTextarea
              :model-value="typeof state.sourceMetadata === 'string' ? state.sourceMetadata : JSON.stringify(state.sourceMetadata, null, 2)"
              @update:model-value="(val) => { try { state.sourceMetadata = val ? JSON.parse(val) : {} } catch (e) { console.error('Invalid JSON:', e) } }"
              class="w-full font-mono text-sm"
              :rows="6"
              placeholder='{}'
            />
          </UFormField>
        </div>
      </div>
      </template>

      <template #footer>
        <CroutonValidationErrorSummary
          v-if="validationErrors.length > 0"
          :tab-errors="tabErrorCounts"
          :navigation-items="navigationItems"
          @switch-tab="switchToTab"
        />

        <CroutonFormActionButton
          :action="action"
          :collection="collection"
          :items="items"
          :loading="loading"
          :has-validation-errors="validationErrors.length > 0"
        />
      </template>
    </CroutonFormLayout>
  </UForm>

  <!-- Prompt Preview Modal -->
  <PromptPreviewModal
    v-model="showPromptPreview"
    :preview="promptPreview"
    :custom-summary-prompt="state.aiSummaryPrompt"
    :custom-task-prompt="state.aiTaskPrompt"
  />
</template>

<script setup lang="ts">
import type { DiscubotConfigFormProps, DiscubotConfigFormData } from '../../types'
import type { PromptPreview } from '#layers/discubot/app/composables/usePromptPreview'
import PromptPreviewModal from './PromptPreviewModal.vue'

const props = defineProps<DiscubotConfigFormProps>()

// Get current team for OAuth flow
const { currentTeam } = useTeam()
const { defaultValue, schema, collection } = useDiscubotConfigs()

// Source type options
const sourceTypeOptions = [
  { label: 'Figma', value: 'figma' },
  { label: 'Slack', value: 'slack' }
]

// Get EMAIL_DOMAIN from runtime config
const config = useRuntimeConfig()
const EMAIL_DOMAIN = config.public.emailDomain || 'messages.friendlyinter.net'

// Auto-generate email slug from name (kebab-case)
const generateEmailSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .substring(0, 50) // Limit length
}

// Auto-generate email address from slug
const generateEmailAddress = (slug: string): string => {
  if (!slug) return ''
  return `${slug}@${EMAIL_DOMAIN}`
}

// UI state
const tabs = ref(true)
const activeSection = ref('basic')

// Map field names to their tab groups for error tracking
const fieldToGroup: Record<string, string> = {
  'sourceType': 'basic',
  'name': 'basic',
  'emailAddress': 'email',
  'emailSlug': 'email',
  'webhookUrl': 'webhook',
  'webhookSecret': 'webhook',
  'apiToken': 'credentials',
  'notionToken': 'credentials',
  'anthropicApiKey': 'credentials',
  'notionDatabaseId': 'notion',
  'notionFieldMapping': 'notion',
  'aiSummaryPrompt': 'ai',
  'aiTaskPrompt': 'ai'
}

// Track validation errors for tab indicators
const validationErrors = ref<Array<{ name: string; message: string }>>([])

// Handle form validation errors
const handleValidationError = (event: any) => {
  if (event?.errors) {
    validationErrors.value = event.errors
  }
}

// Switch to a specific tab (for clicking error links)
const switchToTab = (tabValue: string) => {
  activeSection.value = tabValue
}

// Use new mutation composable for data operations
const { create, update, deleteItems } = useCollectionMutation(collection)

// useCrouton still manages modal state
const { close } = useCrouton()

// Initialize form state with proper values (no watch needed!)
const initialValues = props.action === 'update' && props.activeItem?.id
  ? { ...defaultValue, ...props.activeItem }
  : { ...defaultValue }

const state = ref<DiscubotConfigFormData & { id?: string | null }>(initialValues)

// Preset templates for Summary prompts
const summaryPresets = [
  {
    label: 'Design Teams',
    value: 'design',
    description: 'Focus on design decisions, visual feedback, and UI/UX considerations. Prioritize color, layout, typography, and user experience feedback.'
  },
  {
    label: 'Engineering Teams',
    value: 'engineering',
    description: 'Focus on technical implementation details, bug reports, and performance considerations. Extract specific technical requirements and code-related decisions.'
  },
  {
    label: 'Product Teams',
    value: 'product',
    description: 'Emphasize product decisions, feature requests, and user feedback. Highlight strategic direction and product roadmap implications.'
  },
  {
    label: 'Marketing Teams',
    value: 'marketing',
    description: 'Focus on messaging, brand voice, campaign feedback, and customer-facing content. Extract insights about positioning and communication strategy.'
  }
]

// Preset templates for Task Detection prompts
const taskPresets = [
  {
    label: 'Design Tasks Only',
    value: 'design-tasks',
    description: 'Extract only design-related tasks: UI updates, visual changes, mockup creation, design system updates, and accessibility improvements.'
  },
  {
    label: 'Engineering Tasks Only',
    value: 'engineering-tasks',
    description: 'Extract only technical tasks: bug fixes, feature implementation, refactoring, technical debt, performance optimization, and code reviews.'
  },
  {
    label: 'Action Items & Deadlines',
    value: 'action-deadlines',
    description: 'Focus on actionable items with clear owners and deadlines. Prioritize tasks marked as urgent or time-sensitive. Extract due dates and assignees.'
  },
  {
    label: 'Frontend/UI Tasks',
    value: 'frontend-tasks',
    description: 'Extract frontend and UI-specific tasks only. Focus on component updates, styling changes, responsive design, and user interface improvements.'
  }
]

// Insert selected summary preset into the textarea
const insertSummaryPreset = (value: string | null) => {
  if (!value) return
  const preset = summaryPresets.find(p => p.value === value)
  if (preset) {
    state.value.aiSummaryPrompt = preset.description
  }
}

// Insert selected task preset into the textarea
const insertTaskPreset = (value: string | null) => {
  if (!value) return
  const preset = taskPresets.find(p => p.value === value)
  if (preset) {
    state.value.aiTaskPrompt = preset.description
  }
}

// Field mapping state
interface FieldMapping {
  notionProperty: string
  propertyType: string
  valueMap: Record<string, string>
}

interface FieldMappings {
  priority: FieldMapping
  type: FieldMapping
  assignee: FieldMapping
}

const fetchingSchema = ref(false)
const schemaFetchError = ref<string | null>(null)
const fetchedSchema = ref<any>(null)
const autoGeneratedMapping = ref<any>(null)

// Initialize field mappings from state
const fieldMappings = ref<FieldMappings>({
  priority: {
    notionProperty: '',
    propertyType: '',
    valueMap: {}
  },
  type: {
    notionProperty: '',
    propertyType: '',
    valueMap: {}
  },
  assignee: {
    notionProperty: '',
    propertyType: '',
    valueMap: {}
  }
})

// Load existing field mappings from state on mount
onMounted(() => {
  if (state.value.notionFieldMapping && typeof state.value.notionFieldMapping === 'object') {
    const mapping = state.value.notionFieldMapping as any

    // Load priority
    if (mapping.priority) {
      fieldMappings.value.priority = {
        notionProperty: mapping.priority.notionProperty || '',
        propertyType: mapping.priority.propertyType || '',
        valueMap: mapping.priority.valueMap || {}
      }
    }

    // Load type
    if (mapping.type) {
      fieldMappings.value.type = {
        notionProperty: mapping.type.notionProperty || '',
        propertyType: mapping.type.propertyType || '',
        valueMap: mapping.type.valueMap || {}
      }
    }

    // Load assignee
    if (mapping.assignee) {
      fieldMappings.value.assignee = {
        notionProperty: mapping.assignee.notionProperty || '',
        propertyType: mapping.assignee.propertyType || '',
        valueMap: mapping.assignee.valueMap || {}
      }
    }
  }
})

// Watch field mappings and sync to state
watch(fieldMappings, (newMappings) => {
  const mappingObject: Record<string, any> = {}

  if (newMappings.priority.notionProperty) {
    mappingObject.priority = {
      notionProperty: newMappings.priority.notionProperty,
      propertyType: newMappings.priority.propertyType,
      valueMap: newMappings.priority.valueMap
    }
  }

  if (newMappings.type.notionProperty) {
    mappingObject.type = {
      notionProperty: newMappings.type.notionProperty,
      propertyType: newMappings.type.propertyType,
      valueMap: newMappings.type.valueMap
    }
  }

  if (newMappings.assignee.notionProperty) {
    mappingObject.assignee = {
      notionProperty: newMappings.assignee.notionProperty,
      propertyType: newMappings.assignee.propertyType,
      valueMap: newMappings.assignee.valueMap
    }
  }

  state.value.notionFieldMapping = mappingObject
}, { deep: true })

// Watch for property selection changes to update property type
watch(() => fieldMappings.value.priority.notionProperty, (newProp) => {
  if (newProp && fetchedSchema.value) {
    const propInfo = fetchedSchema.value.properties[newProp]
    if (propInfo) {
      fieldMappings.value.priority.propertyType = propInfo.type
    }
  }
})

watch(() => fieldMappings.value.type.notionProperty, (newProp) => {
  if (newProp && fetchedSchema.value) {
    const propInfo = fetchedSchema.value.properties[newProp]
    if (propInfo) {
      fieldMappings.value.type.propertyType = propInfo.type
    }
  }
})

watch(() => fieldMappings.value.assignee.notionProperty, (newProp) => {
  if (newProp && fetchedSchema.value) {
    const propInfo = fetchedSchema.value.properties[newProp]
    if (propInfo) {
      fieldMappings.value.assignee.propertyType = propInfo.type
    }
  }
})

// Notion property options for select menus
const notionPropertyOptions = computed(() => {
  if (!fetchedSchema.value) return []

  return Object.keys(fetchedSchema.value.properties).map(propName => ({
    label: propName,
    value: propName
  }))
})

// Simple client-side fuzzy matching (similar to server-side utility)
const calculateSimilarity = (str1: string, str2: string): number => {
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()

  if (s1 === s2) return 1.0
  if (s1.includes(s2) || s2.includes(s1)) return 0.8

  const minLength = Math.min(s1.length, s2.length)
  let matchingChars = 0
  for (let i = 0; i < minLength; i++) {
    if (s1[i] === s2[i]) matchingChars++
    else break
  }

  return matchingChars / Math.max(s1.length, s2.length)
}

// Find best matching Notion property
const findBestMatch = (aiField: string, properties: Record<string, any>) => {
  let bestMatch: { propertyName: string; propertyType: string; score: number } | null = null

  for (const [propName, propInfo] of Object.entries(properties)) {
    const score = calculateSimilarity(aiField, propName)

    if (score > 0.5 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = {
        propertyName: propName,
        propertyType: propInfo.type,
        score
      }
    }
  }

  return bestMatch
}

// Generate value mapping for select fields
const generateValueMapping = (
  aiFieldType: string,
  notionOptions?: Array<{ name: string }>
): Record<string, string> => {
  if (!notionOptions || notionOptions.length === 0) return {}

  const valueMap: Record<string, string> = {}
  const aiValues = aiFieldType === 'priority'
    ? ['low', 'medium', 'high', 'urgent']
    : ['bug', 'feature', 'question', 'improvement']

  for (const aiValue of aiValues) {
    let bestMatch: { name: string; score: number } | null = null

    for (const option of notionOptions) {
      const score = calculateSimilarity(aiValue, option.name)
      if (score > 0.3 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { name: option.name, score }
      }
    }

    if (bestMatch) {
      valueMap[aiValue] = bestMatch.name
    }
  }

  return valueMap
}

// Generate auto mapping from schema
const generateAutoMapping = (schema: any) => {
  const mapping: Record<string, any> = {}
  const aiFields = ['priority', 'type', 'assignee']

  for (const aiField of aiFields) {
    const match = findBestMatch(aiField, schema.properties)

    if (match) {
      mapping[aiField] = {
        notionProperty: match.propertyName,
        propertyType: match.propertyType,
        valueMap: {}
      }

      // Generate value mapping for select/status fields
      if (match.propertyType === 'select' || match.propertyType === 'status') {
        const propInfo = schema.properties[match.propertyName]
        if (propInfo.options) {
          mapping[aiField].valueMap = generateValueMapping(aiField, propInfo.options)
        }
      }
    }
  }

  return mapping
}

// Fetch Notion schema
const fetchNotionSchema = async () => {
  if (!state.value.notionDatabaseId || !state.value.notionToken) {
    schemaFetchError.value = 'Please provide both Notion Database ID and Integration Token'
    return
  }

  fetchingSchema.value = true
  schemaFetchError.value = null

  try {
    const response = await $fetch(`/api/notion/schema/${state.value.notionDatabaseId}`, {
      query: {
        notionToken: state.value.notionToken
      }
    })

    if (response.success) {
      fetchedSchema.value = response

      // Generate default mapping using client-side fuzzy matching
      autoGeneratedMapping.value = generateAutoMapping(response)

      // Apply auto-generated mappings
      applyAutoGeneratedMapping()
    }
  } catch (error: any) {
    console.error('Failed to fetch schema:', error)
    schemaFetchError.value = error.data?.statusMessage || error.message || 'Failed to fetch schema'
  } finally {
    fetchingSchema.value = false
  }
}

// Apply auto-generated mapping to field mappings
const applyAutoGeneratedMapping = () => {
  if (!autoGeneratedMapping.value) return

  const mapping = autoGeneratedMapping.value

  if (mapping.priority) {
    fieldMappings.value.priority = {
      notionProperty: mapping.priority.notionProperty || '',
      propertyType: mapping.priority.propertyType || '',
      valueMap: mapping.priority.valueMap || {}
    }
  }

  if (mapping.type) {
    fieldMappings.value.type = {
      notionProperty: mapping.type.notionProperty || '',
      propertyType: mapping.type.propertyType || '',
      valueMap: mapping.type.valueMap || {}
    }
  }

  if (mapping.assignee) {
    fieldMappings.value.assignee = {
      notionProperty: mapping.assignee.notionProperty || '',
      propertyType: mapping.assignee.propertyType || '',
      valueMap: mapping.assignee.valueMap || {}
    }
  }
}

// Reset to auto-generated mapping
const resetToAutoGenerated = () => {
  applyAutoGeneratedMapping()
}

// Get property type color for badge
const getPropertyTypeColor = (type: string): string => {
  const colorMap: Record<string, string> = {
    'select': 'blue',
    'multi_select': 'purple',
    'status': 'green',
    'people': 'orange',
    'date': 'pink',
    'rich_text': 'gray',
    'title': 'gray'
  }

  return colorMap[type] || 'gray'
}

// Handle JSON update from textarea
const handleJsonUpdate = (val: string) => {
  try {
    const parsed = val ? JSON.parse(val) : {}
    state.value.notionFieldMapping = parsed

    // Also update field mappings UI
    if (parsed.priority) {
      fieldMappings.value.priority = {
        notionProperty: parsed.priority.notionProperty || '',
        propertyType: parsed.priority.propertyType || '',
        valueMap: parsed.priority.valueMap || {}
      }
    }

    if (parsed.type) {
      fieldMappings.value.type = {
        notionProperty: parsed.type.notionProperty || '',
        propertyType: parsed.type.propertyType || '',
        valueMap: parsed.type.valueMap || {}
      }
    }

    if (parsed.assignee) {
      fieldMappings.value.assignee = {
        notionProperty: parsed.assignee.notionProperty || '',
        propertyType: parsed.assignee.propertyType || '',
        valueMap: parsed.assignee.valueMap || {}
      }
    }
  } catch (e) {
    console.error('Invalid JSON:', e)
  }
}

// Prompt preview state
const { buildPreview } = usePromptPreview()
const showPromptPreview = ref(false)
const promptPreview = ref<PromptPreview>(buildPreview())

// Open prompt preview modal
const openPromptPreview = () => {
  promptPreview.value = buildPreview(state.value.aiSummaryPrompt, state.value.aiTaskPrompt)
  showPromptPreview.value = true
}

// Computed properties for conditional rendering (must be after state definition)
const isFigmaSource = computed(() => state.value.sourceType === 'figma')
const isSlackSource = computed(() => state.value.sourceType === 'slack')

// OAuth computed properties
const hasOAuthConnection = computed(() => {
  return isSlackSource.value &&
         state.value.sourceMetadata &&
         (state.value.sourceMetadata as any)?.slackTeamId
})

const oauthWorkspaceName = computed(() => {
  if (!hasOAuthConnection.value) return null
  return (state.value.sourceMetadata as any)?.slackTeamName || 'Connected Workspace'
})

const oauthInstallUrl = computed(() => {
  if (!currentTeam.value?.id) return '#'
  return `/api/oauth/slack/install?teamId=${currentTeam.value.id}`
})

// OAuth Popup Window
function openOAuthPopup(event?: Event) {
  // Prevent any default behavior
  if (event) {
    event.preventDefault()
    event.stopPropagation()
  }

  console.log('[OAuth Popup] Opening popup with URL:', oauthInstallUrl.value)
  console.log('[OAuth Popup] Current team:', currentTeam.value)

  const width = 600
  const height = 800
  const left = (window.screen.width - width) / 2
  const top = (window.screen.height - height) / 2

  const features = `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
  console.log('[OAuth Popup] Window features:', features)

  // Open popup
  const popup = window.open(
    oauthInstallUrl.value,
    'slack-oauth',
    features
  )

  console.log('[OAuth Popup] Popup opened:', !!popup)

  if (popup) {
    popup.focus()
    const toast = useToast()
    toast.add({
      title: 'Opening Slack Authorization',
      description: 'Complete the authorization in the popup window',
      color: 'primary',
      timeout: 5000
    })
  } else {
    console.error('[OAuth Popup] Failed to open popup - check popup blocker')
    const toast = useToast()
    toast.add({
      title: 'Popup Blocked',
      description: 'Please allow popups for this site and try again',
      color: 'error',
      timeout: 8000
    })
  }
}

// Listen for OAuth success message from popup
function handleOAuthMessage(event: MessageEvent) {
  console.log('[OAuth Message] Received message:', event.data)

  if (event.data?.type === 'oauth-success') {
    const toast = useToast()
    toast.add({
      title: 'Slack Connected!',
      description: `Successfully connected to ${event.data.team || 'workspace'}`,
      color: 'success',
      timeout: 5000
    })

    console.log('[OAuth Message] OAuth successful, reloading page to refresh data')

    // Reload the page to refresh the config data with new OAuth tokens
    setTimeout(() => {
      window.location.reload()
    }, 1000)
  }
}

onMounted(() => {
  window.addEventListener('message', handleOAuthMessage)
})

onBeforeUnmount(() => {
  window.removeEventListener('message', handleOAuthMessage)
})

// Form layout configuration - dynamic based on source type
const navigationItems = computed(() => {
  const base = [{ label: 'Basic', value: 'basic' }]

  if (isFigmaSource.value) {
    base.push({ label: 'Email', value: 'email' })
  }

  if (isSlackSource.value) {
    base.push({ label: 'Webhook', value: 'webhook' })
  }

  base.push(
    { label: 'Credentials', value: 'credentials' },
    { label: 'Notion', value: 'notion' },
    { label: 'AI', value: 'ai' }
  )

  return base
})

// Compute errors per tab
const tabErrorCounts = computed(() => {
  const counts: Record<string, number> = {}

  validationErrors.value.forEach(error => {
    const tabName = fieldToGroup[error.name] || 'general'
    counts[tabName] = (counts[tabName] || 0) + 1
  })

  return counts
})

// Watch for name changes to auto-generate slug and email (only for new configs)
watch(() => state.value.name, (newName) => {
  if (props.action === 'create' && isFigmaSource.value && newName) {
    const slug = generateEmailSlug(newName)
    state.value.emailSlug = slug
    state.value.emailAddress = generateEmailAddress(slug)
  }
})

// Watch for slug changes to update email address
watch(() => state.value.emailSlug, (newSlug) => {
  if (isFigmaSource.value && newSlug) {
    state.value.emailAddress = generateEmailAddress(newSlug)
  }
})

const handleSubmit = async () => {
  try {
    if (props.action === 'create') {
      await create(state.value)
    } else if (props.action === 'update' && state.value.id) {
      await update(state.value.id, state.value)
    } else if (props.action === 'delete') {
      await deleteItems(props.items)
    }

    // Clear validation errors on successful submission
    validationErrors.value = []

    close()

  } catch (error) {
    console.error('Form submission failed:', error)
    // You can add toast notification here if available
    // toast.add({ title: 'Error', description: 'Failed to submit form', color: 'red' })
  }
}
</script>
