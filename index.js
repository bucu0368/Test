
const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
const axios = require('axios');
const config = require('./config.json');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Slash command definition
const commands = [
    new SlashCommandBuilder()
        .setName('search')
        .setDescription('Search commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('youtube')
                .setDescription('Search for YouTube videos')
                .addStringOption(option =>
                    option
                        .setName('query')
                        .setDescription('Search query for YouTube')
                        .setRequired(true)
                )
        )
].map(command => command.toJSON());

// Register slash commands
async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(config.token);
    
    try {
        console.log('Started refreshing application (/) commands.');
        
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
}

// YouTube search function
async function searchYouTube(query) {
    try {
        const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            params: {
                part: 'snippet',
                q: query,
                key: config.youtubeApiKey,
                type: 'video',
                maxResults: 1,
                order: 'relevance'
            }
        });

        if (response.data.items && response.data.items.length > 0) {
            const video = response.data.items[0];
            
            // Get additional video details
            const videoDetailsResponse = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
                params: {
                    part: 'contentDetails,statistics',
                    id: video.id.videoId,
                    key: config.youtubeApiKey
                }
            });

            const videoDetails = videoDetailsResponse.data.items[0];
            
            // Convert ISO 8601 duration to readable format
            const duration = parseDuration(videoDetails.contentDetails.duration);
            
            return {
                success: true,
                data: {
                    title: video.snippet.title,
                    duration: duration.totalSeconds,
                    duration_string: duration.formatted,
                    uploaded: video.snippet.publishedAt.split('T')[0],
                    views: parseInt(videoDetails.statistics.viewCount) || 0,
                    likes: parseInt(videoDetails.statistics.likeCount) || 0,
                    dislikes: 0, // YouTube API no longer provides dislike count
                    uploader: video.snippet.channelTitle,
                    video_id: video.id.videoId,
                    url: `https://www.youtube.com/watch?v=${video.id.videoId}`,
                    description: video.snippet.description,
                    thumbnail: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.default.url
                }
            };
        } else {
            return {
                success: false,
                error: 'No videos found'
            };
        }
    } catch (error) {
        console.error('YouTube API Error:', error);
        return {
            success: false,
            error: 'Failed to search YouTube'
        };
    }
}

// Parse ISO 8601 duration to readable format
function parseDuration(duration) {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2]) || 0;
    const seconds = parseInt(match[3]) || 0;
    
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    const formatted = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    return { totalSeconds, formatted };
}

// Format number with commas
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    await registerCommands();
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options } = interaction;

    if (commandName === 'search') {
        const subcommand = options.getSubcommand();
        
        if (subcommand === 'youtube') {
            const query = options.getString('query');
            
            await interaction.deferReply();
            
            const result = await searchYouTube(query);
            
            if (result.success) {
                const data = result.data;
                
                const embed = new EmbedBuilder()
                    .setTitle(data.title)
                
                    .setURL(data.url)
                    .setDescription(data.description.length > 200 ? data.description.substring(0, 200) + '...' : data.description)
                    .setThumbnail(data.thumbnail)
.setImage(data.thumbnail)                   .setColor(0xFF0000)
                    .addFields(
                        { name: '📺 Channel', value: data.uploader, inline: true },
                        { name: '⏱️ Duration', value: data.duration_string, inline: true },
                        { name: '📅 Uploaded', value: data.uploaded, inline: true },
                        { name: '👀 Views', value: formatNumber(data.views), inline: true },
                        { name: '👍 Likes', value: formatNumber(data.likes), inline: true },
                        { name: '🆔 Video ID', value: data.video_id, inline: true }
                    )
                    .setFooter({ text: 'YouTube Search Results' })
                    .setTimestamp();
                
                await 
interaction.editReply({ embeds: [embed] });
            } else {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ Search Failed')
                    .setDescription(result.error || 'Could not find any videos for your query.')
                    .setColor(0xFF0000);

                await interaction.editReply({ embeds: [errorEmbed] });
            }
        }
    }
});

client.login(config.token);
