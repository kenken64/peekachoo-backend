const { initDatabase, prepare } = require('./src/config/sqlite');

async function check() {
    await initDatabase();

    // Get recent sessions with game names
    const sessions = prepare(`
        SELECT
            gs.id,
            gs.total_score,
            gs.levels_completed,
            gs.highest_level,
            gs.started_at,
            gs.ended_at,
            g.name as game_name,
            u.username
        FROM game_sessions gs
        LEFT JOIN games g ON g.id = gs.game_id
        LEFT JOIN users u ON u.id = gs.user_id
        ORDER BY gs.started_at DESC
        LIMIT 10
    `).all();

    console.log('=== Recent Game Sessions ===');
    sessions.forEach(s => {
        console.log(`Game: ${s.game_name || 'Classic'} | Score: ${s.total_score} | Levels: ${s.levels_completed} | User: ${s.username} | Time: ${s.started_at}`);
    });

    // Get recent scores
    const scores = prepare(`
        SELECT
            ps.level,
            ps.total_score,
            ps.pokemon_name,
            ps.session_id,
            ps.created_at
        FROM player_scores ps
        ORDER BY ps.created_at DESC
        LIMIT 15
    `).all();

    console.log('\n=== Recent Player Scores ===');
    scores.forEach(s => {
        console.log(`Level ${s.level} | Score: ${s.total_score} | Pokemon: ${s.pokemon_name} | Session: ${s.session_id.substring(0,8)}...`);
    });

    // Check player stats
    const stats = prepare(`SELECT * FROM player_stats`).all();
    console.log('\n=== Player Stats ===');
    stats.forEach(s => {
        console.log(`User: ${s.user_id.substring(0,8)}... | Total Score: ${s.total_score_all_time} | Levels: ${s.total_levels_completed} | Games: ${s.total_games_played}`);
    });
}

check().catch(console.error);
