menuitem-generateSummary = Summon AI Butler for Analysis
menuitem-chatWithAI = AI Butler - Follow-up Questions
menuitem-multiRoundReanalyze = AI Butler Multi-round Deep Reading
menuitem-multiRoundConcat = Multi-round Concatenation
menuitem-multiRoundSummary = Multi-round Summary
menuitem-imageSummary = AI Butler One-Image Summary
menuitem-mindmap = AI Butler Generate Mind Map
error-noItemsSelected = Sorry, you haven't selected any references to analyze.
error-noApiKey = Sorry, the API key is not configured. I cannot begin working.
success-allComplete = All tasks have been completed!
progress-extracting = Extracting reference content...
progress-generating = AI Butler is analyzing...
progress-creating = Organizing into notes...
progress-complete = Task complete!

itempane-ai-section-header =
    .label = AI Butler
itempane-ai-section-sidenav =
    .tooltiptext = AI Butler

menuitem-literatureReview = AI Butler Literature Review
menuitem-fillTable = AI Butler Fill Table

# Chat UI strings
chat-user-label = User
chat-assistant-label = AI Butler
chat-saved-time = Saved at
chat-saved-time-quick = from quick question

# Task Queue UI strings
task-created-time = Created
task-completed-time = Completed
task-error-label = Error
task-retry-count = Retry count
task-stage-label = Stage

# Dashboard strings
dashboard-title = Dashboard
dashboard-status-resting = AI Butler is resting
dashboard-status-working = AI Butler is working hard
dashboard-status-error = AI Butler encountered a problem
dashboard-status-detail-error = Please check configuration or view error log
dashboard-status-detail-resting = Butler has summarized { $count } references for you
dashboard-status-detail-working = Reading: { $item }
dashboard-status-detail-working-remaining = Reading: { $item } ({ $remaining } remaining)
dashboard-status-detail-processing = Processing references...
dashboard-button-scan = Scan Unanalyzed Papers
dashboard-button-start-auto = Start Auto Scan
dashboard-button-pause-auto = Pause Auto Scan
dashboard-button-clear = Clear Completed
dashboard-success-auto-started = ✅ Auto scan started
dashboard-success-auto-paused = ⏸️ Auto scan paused
dashboard-success-cleared = 🗑️ Cleared completed tasks
dashboard-task-completed = ✅ Completed: { $title }
dashboard-error-unknown = Unknown error

# Library Scanner strings
scanner-title = Library Scan Results
scanner-scanning = Scanning...
scanner-selected = Selected: <strong>{ $count }</strong>
scanner-all-complete = 🎉 All references have been analyzed!
scanner-uncategorized = Uncategorized References
scanner-found-unprocessed = Found <strong>{ $count }</strong> references not yet analyzed by AI
scanner-please-select = Please select references to analyze first

# Literature Review strings
review-title = 📚 AI Butler Literature Review
review-select-collection = Please select a collection...
review-name-label = Review Name
review-prompt-label = Review Prompt
review-table-template-label = Table Template Prompt
review-targeted-items-label = Table items for targeted questions
review-select-pdfs-label = Select PDFs to include in review
review-selected-pdfs = Selected: <strong>{ $count }</strong> PDFs
review-no-pdfs = 📭<br><br>No references with PDF attachments in this collection
review-filled-table = 📊 Table Filled
review-reviewed = ✅ Reviewed
review-no-items-parsed = Current table template has no parseable items
review-select-at-least-one-pdf = Please select at least one PDF
review-select-at-least-one-item = Please check at least one table item
review-append-items-required = Append new items is checked, please fill in at least one new table item

# Summary View strings
summary-notes-title = 📘 AI Butler Notes
summary-enter-question = Please enter your question
summary-no-context = No paper context available, please generate summary first
summary-error-prefix = ❌ Error
summary-not-found = No saved AI summary notes found.
summary-cannot-load = Unable to load saved summary for this item.
summary-instructions = Right-click a reference item and select "AI Butler Analysis" to start generating summary
summary-elapsed = Elapsed: { $seconds } seconds
summary-opening-queue = ⏳ Opening task queue...
summary-interrupted = ⏹️ Interrupted, view task queue

# Task Queue View strings
taskqueue-title = 📋 Task Queue Management
taskqueue-clear-completed = 🗑️ Clear Completed

# Main Window strings
mainwindow-tab-dashboard = Dashboard

# Settings strings
settings-data-management = 💾 Data Management

# Stat card strings (Dashboard)
stat-total-processed = Total Processed
stat-today-processed = Today Processed
stat-pending = Pending
stat-success-rate = Success Rate
stat-avg-time = Avg Time
stat-failed = Failed

# Button labels
dashboard-button-view-queue = View Task Queue
dashboard-button-settings = Open Settings
dashboard-task-failed = ❌ Processing failed: { $title }

button-save-preset = Save Preset
button-generate-review = 🚀 Generate Review
button-example-prompt = e.g., Compare only "Research Methods" dimension, provide differences and applicable scenarios
button-append-items-prompt = Enter items to append, separate multiple items with commas or newlines

# Progress messages
progress-right-click-instruction = Right-click a reference item and select "AI Butler Analysis" to start generating summary
