# TaskFlow Pro
Task manager built with React + Vite. Data lives only in your browser's localStorage.

## Run
    npm install
    npm run dev       # development
    npm run build     # production build
    npm run preview   # preview the build

## Features
Tasks (add/edit/delete/complete, undo delete), priorities, projects, tags, search, filters, sorting,
Today / Upcoming / Overdue / Inbox / Completed views, scheduled start–end times with live countdown,
expiry alarm (repeats until stopped; extend 5/10/15/custom), 8 synthesized Web Audio ringtones with preview,
independent completion sound, light/dark/system theme, JSON export/import, keyboard shortcuts (/ and N).

Note: alarms work only while the page is open. Browsers need a click first before audio can play — use "Enable / Test Sound" in Settings.

## Deploy
    git init && git add . && git commit -m "TaskFlow Pro"
    git branch -M main
    git remote add origin https://github.com/YOUR-NAME/taskflow-pro.git
    git push -u origin main
Then on vercel.com: Add New → Project → import the repo → Deploy (Vite is auto-detected).
