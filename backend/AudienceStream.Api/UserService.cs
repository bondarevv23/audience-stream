using Npgsql;

namespace AudienceStream.Api;

public record UserPoints(string UserId, int Points);

public class UserService(NpgsqlDataSource dataSource)
{
    public async Task EnsureSchemaAsync()
    {
        await using var conn = await dataSource.OpenConnectionAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS users (
                user_id    TEXT        PRIMARY KEY,
                points     INTEGER     NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """;
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task<List<UserPoints>> AddPointsAsync(Dictionary<string, int> userDeltas)
    {
        var results = new List<UserPoints>();

        await using var conn = await dataSource.OpenConnectionAsync();

        foreach (var (userId, delta) in userDeltas)
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = """
                INSERT INTO users (user_id, points)
                VALUES (@userId, @delta)
                ON CONFLICT (user_id)
                DO UPDATE SET points = users.points + EXCLUDED.points
                RETURNING points
                """;
            cmd.Parameters.AddWithValue("userId", userId);
            cmd.Parameters.AddWithValue("delta", delta);

            var points = (int)(await cmd.ExecuteScalarAsync())!;
            results.Add(new UserPoints(userId, points));
        }

        return results;
    }
}