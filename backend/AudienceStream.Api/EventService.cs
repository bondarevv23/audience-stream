using MongoDB.Bson;
using MongoDB.Driver;

namespace AudienceStream.Api;

public class EventService(IMongoDatabase database)
{
    private readonly IMongoCollection<BsonDocument> _events =
        database.GetCollection<BsonDocument>("events");

    public async Task EnsureIndexesAsync()
    {
        var indexes = new[]
        {
            new CreateIndexModel<BsonDocument>(
                Builders<BsonDocument>.IndexKeys.Ascending("user_id")),
            new CreateIndexModel<BsonDocument>(
                Builders<BsonDocument>.IndexKeys.Ascending("event_type")),
        };
        await _events.Indexes.CreateManyAsync(indexes);
    }

    public async Task InsertBatchAsync(IEnumerable<BsonDocument> documents)
    {
        await _events.InsertManyAsync(documents);
    }
}