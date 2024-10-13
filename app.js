const express = require('express');
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const app = express();

// Serve static files like favicon.ico from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
// Set EJS as the templating engine
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

function readPosts() {
    const postsDir = path.join(__dirname, 'content', 'posts');
    const files = fs.readdirSync(postsDir);
    const posts = files.map(file => {
        const filePath = path.join(postsDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const [metaData, body] = content.split('---').filter(Boolean);
        return {
            title: metaData.match(/title:\s*(.*)/)[1],
            date: metaData.match(/date:\s*(.*)/)[1],
            content: marked(body.trim()),
            filename: file
        };
    });
    return posts;
}

// Helper function to parse front matter
function parseMarkdownFrontMatter(content) {
    const frontMatterRegex = /^---\n([\s\S]*?)\n---/;
    const match = content.match(frontMatterRegex);
    if (match) {
        const frontMatter = match[1];
        const metadata = {};
        frontMatter.split('\n').forEach(line => {
            const [key, ...value] = line.split(':');
            if (key) {
                metadata[key.trim()] = value.join(':').trim();
            }
        });
        // Remove the front matter from the original content
        const contentWithoutFrontMatter = content.replace(frontMatterRegex, '').trim();
        return { metadata, content: contentWithoutFrontMatter };
    }
    return { metadata: {}, content };
}

// Route for serving the posts page
// Route for serving the posts page
app.get('/posts', (req, res) => {
    const postsDir = path.join(__dirname, 'content', 'posts');

    // Read the posts directory
    fs.readdir(postsDir, (err, files) => {
        if (err) {
            return res.status(500).send('Error reading posts directory');
        }

        // Filter Markdown files and extract metadata from the content
        const posts = files.filter(file => file.endsWith('.md')).map(file => {
            const filePath = path.join(postsDir, file);
            const data = fs.readFileSync(filePath, 'utf8');
            const { metadata } = parseMarkdownFrontMatter(data);
            const title = metadata.title || file.replace('.md', '');
            const date = new Date(metadata.date).toLocaleString(); // Format date
            return {
                date,
                title,
                url: `/posts/${file.replace('.md', '')}`,
                filename: file.replace('.md', '') // Remove the .md extension for the link
            };
        });

        // Sort posts by date, newest first
        posts.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Create the content for the posts
        const postsContent = `
            <h1>Posts</h1>
            <ul>
                ${posts.map(post => `
                    <li>
                        <a href="${post.url}">${post.title}</a> <small>(${post.date})</small>
                    </li>
                `).join('')}
            </ul>
        `;

        // Render the layout with the posts content
        res.render('layout', {
            title: 'Posts',
            content: postsContent // Pass the posts content here
        });
    });
});

// Individual post route
app.get('/posts/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'content', 'posts', filename + '.md'); // Update path to include 'content/posts'
    
    // Check if the file exists before reading
    if (!fs.existsSync(filePath)) {
        return res.status(404).send('Post not found'); // Handle file not found error
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const [metaData, body] = content.split('---').filter(Boolean);
    const title = metaData.match(/title:\s*(.*)/)[1];
    const htmlContent = marked(body.trim());
    res.render('layout', { title, content: htmlContent });
});


// Route for individual post pages
app.get('/posts/:post', (req, res) => {
    const postFile = path.join(__dirname, 'content', 'posts', `${req.params.post}.md`);

    // Read the Markdown file for the individual post
    fs.readFile(postFile, 'utf8', (err, data) => {
        if (err) {
            return res.status(404).render('layout', { title: '404', content: 'Post not found' });
        }

        // Extract metadata and content from the Markdown file
        const { metadata, content } = parseMarkdownFrontMatter(data);
        
        // Convert the content to HTML
        const htmlContent = marked(content);

        // Render the individual post page
        const title = metadata.title || req.params.post.replace(/-/g, ' ');
        res.render('layout', {
            title,
            content: htmlContent
        });
    });
});

// Search route
app.get('/search', (req, res) => {
    const query = req.query.query.toLowerCase();
    const posts = readPosts();
    const filteredPosts = posts.filter(post => 
        post.title.toLowerCase().includes(query) || 
        post.content.toLowerCase().includes(query)
    );

    const content = `
        <h2>Search Results for "${query}"</h2>
        <ul>
            ${filteredPosts.length > 0 ? filteredPosts.map(post => `<li><a href="/posts/${post.filename}">${post.title}</a> - ${new Date(post.date).toLocaleDateString()}</li>`).join('') : '<li>No results found</li>'}
        </ul>
    `;
    res.render('layout', { title: 'Search Results', content });
});

// Route for serving pages based on Markdown files
app.get('/:page?', (req, res) => {
    const page = req.params.page || 'index';
    const filePath = path.join(__dirname, 'content', `${page}.md`);
    
    // Read the Markdown file
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            return res.status(404).render('layout', { title: '404', content: 'Page not found' });
        }

        // Extract metadata and content from the Markdown file
        const { content } = parseMarkdownFrontMatter(data);
        
        // Convert the content to HTML
        const htmlContent = marked(content);
        
        // Render the EJS template and pass the content
        res.render('layout', { title: page.charAt(0).toUpperCase() + page.slice(1), content: htmlContent });
    });
});

// Start the server
app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});