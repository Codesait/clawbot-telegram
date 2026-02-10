
import { extractUrl } from '../utils.js';

export const jobSearchSkill = {
    name: 'job_search',
    description: 'Tools for analyzing CVs and finding jobs.',
    tools: [
        {
            type: 'function',
            function: {
                name: 'read_cv',
                description: 'Extracts text from a CV (PDF or Google Doc URL) to understand the user\'s skills and experience.',
                parameters: {
                    type: 'object',
                    properties: {
                        file_url: {
                            type: 'string',
                            description: 'The URL of the file or Google Doc to read.'
                        }
                    },
                    required: ['file_url']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'search_jobs',
                description: 'Searches for jobs based on keywords and location.',
                parameters: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'Job title or keywords (e.g., "Senior React Developer").'
                        },
                        location: {
                            type: 'string',
                            description: 'Location to search in (e.g., "Remote", "London").'
                        }
                    },
                    required: ['query']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'save_job_preferences',
                description: 'Saves the user\'s job preferences for daily updates.',
                parameters: {
                    type: 'object',
                    properties: {
                        role: { type: 'string', description: 'Preferred job role.' },
                        keywords: { type: 'array', items: { type: 'string' }, description: 'Key skills or technologies.' },
                        location: { type: 'string', description: 'Preferred location.' }
                    },
                    required: ['role', 'keywords']
                }
            }
        }
    ],
    handlers: {
        async read_cv({ args, env }) {
            try {
                let url = args.file_url;
                console.log(`[CV] Reading from URL: ${url}`);

                // Handle Google Docs specifically
                // Convert https://docs.google.com/document/d/DOC_ID/edit... to https://docs.google.com/document/d/DOC_ID/export?format=txt
                const googleDocMatch = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9-_]+)/);
                if (googleDocMatch && googleDocMatch[1]) {
                    const docId = googleDocMatch[1];
                    url = `https://docs.google.com/document/d/${docId}/export?format=txt`;
                    console.log(`[CV] Converted to Google Doc Export URL: ${url}`);
                }

                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
                    }
                });

                const contentType = response.headers.get('content-type') || '';
                let text = "";

                if (contentType.includes('application/pdf')) {
                    return `[System] I downloaded the PDF but I lack a built-in PDF parser. Please copy-paste the text of your CV directly.`;
                }

                const html = await response.text();

                // Extremely basic text extraction
                text = html.replace(/<script[^>]*>([\S\s]*?)<\/script>/gmi, '')
                    .replace(/<style[^>]*>([\S\s]*?)<\/style>/gmi, '')
                    .replace(/<[^>]*>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();

                text = text.substring(0, 8000); // Limit context window usage

                if (text.length < 100) {
                    return `[System] Content read from URL was too short or empty. It might be protected or require login. Text found: "${text}". Please copy-paste your CV text instead.`;
                }

                return `[System] Successfully read content from URL.
                
                --- START OF CV CONTENT ---
                ${text}
                --- END OF CV CONTENT ---
                
                (Please analyze this content for skills and roles)`;
            } catch (e) {
                return `[System] Failed to fetch CV URL: ${e.message}. Please copy-paste the text.`;
            }
        },

        async search_jobs({ args, env }) {
            try {
                // Real Job Search using RemoteOK API
                // https://remoteok.com/api

                const query = args.query || 'software';
                const location = args.location || '';

                // Clean query: remove punctuation, split by space/comma, filter short words
                // Example: "Flutter, Dart, Kotlin" -> ["flutter", "dart", "kotlin"]
                let tagsArray = query.toLowerCase()
                    .replace(/[^\w\s]/g, ' ') // Replace punctuation with space
                    .split(/\s+/)
                    .filter(w => w.length > 2); // Filter out short words

                // RemoteOK API allows comma separated tags.
                // However, too many tags often result in 0 matches because it might try to match ALL (AND) or generic/specific conflicts.
                // Strategy: Try with all tags first. If 0 results, try with just the first tag (usually the role or main skill).

                let tags = tagsArray.join(',');
                console.log(`[JOB SEARCH] Fetching from RemoteOK with tags: ${tags}`);

                let response = await fetch(`https://remoteok.com/api?tag=${tags}`);
                let data = await response.json();

                // API returns array, first item is legal/disclaimer
                let jobs = data.slice(1);

                // FALLBACK: If 0 results and we have multiple tags, try searching with just the first tag (broadest)
                if (jobs.length === 0 && tagsArray.length > 1) {
                    const fallbackTag = tagsArray[0];
                    console.log(`[JOB SEARCH] No results for "${tags}". Retrying with fallback tag: "${fallbackTag}"`);
                    response = await fetch(`https://remoteok.com/api?tag=${fallbackTag}`);
                    data = await response.json();
                    jobs = data.slice(1);
                }

                // If location is specific, filter by it (text search description/location)
                if (location && location.toLowerCase() !== 'remote') {
                    const loc = location.toLowerCase();
                    jobs = jobs.filter(j =>
                        (j.location && j.location.toLowerCase().includes(loc)) ||
                        (j.description && j.description.toLowerCase().includes(loc))
                    );
                }

                // Take top 5
                const topJobs = jobs.slice(0, 5);

                if (topJobs.length === 0) {
                    return `[System] No jobs found on RemoteOK for tags "${tags}". Try broader keywords (e.g. "software", "engineer", "react").`;
                }

                const jobListStr = topJobs.map((j, i) => {
                    const date = new Date(j.date).toLocaleDateString();
                    return `${i + 1}. **${j.position}** at ${j.company}\n   📍 ${j.location}\n   📅 ${date}\n   🔗 [Apply Here](${j.url})`;
                }).join('\n\n');

                return `[System] Found ${jobs.length} jobs on RemoteOK. Here are the top 5:\n\n${jobListStr}`;

            } catch (e) {
                console.error("Job search error:", e);
                return `[System] Failed to search jobs: ${e.message}.`;
            }
        },

        async save_job_preferences({ args, env, chatId }) {
            const prefs = {
                role: args.role,
                keywords: args.keywords,
                location: args.location || 'Remote'
            };

            // Store in KV
            if (env.USER_PREFS) {
                await env.USER_PREFS.put(`prefs:${chatId}`, JSON.stringify(prefs));
                return `Saved preferences for Daily Job Briefing: ${JSON.stringify(prefs)}`;
            } else {
                return "Error: USER_PREFS KV binding not found.";
            }
        }
    }
};
