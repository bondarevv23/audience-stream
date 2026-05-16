using MongoDB.Bson;
using MongoDB.Bson.IO;
using MongoDB.Driver;

namespace AudienceStream.Api;

public class EventService(IMongoDatabase database)
{
    private readonly IMongoCollection<BsonDocument> _events =
        database.GetCollection<BsonDocument>("events");

    private static readonly ProjectionDefinition<BsonDocument> ExcludeId =
        Builders<BsonDocument>.Projection.Exclude("_id");

    private static readonly JsonWriterSettings RelaxedJson = new()
    {
        OutputMode = JsonOutputMode.RelaxedExtendedJson
    };

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

    public async Task<string> GetRecentEventsAsync(int limit)
    {
        var docs = await _events
            .Find(FilterDefinition<BsonDocument>.Empty)
            .Project(ExcludeId)
            .Sort(Builders<BsonDocument>.Sort.Descending("timestamp"))
            .Limit(limit)
            .ToListAsync();

        return ToJsonArray(docs);
    }

    public async Task<string> GetEventsByTypeAsync(string eventType, int limit)
    {
        var filter = Builders<BsonDocument>.Filter.Eq("event_type", eventType);

        var docs = await _events
            .Find(filter)
            .Project(ExcludeId)
            .Sort(Builders<BsonDocument>.Sort.Descending("timestamp"))
            .Limit(limit)
            .ToListAsync();

        return ToJsonArray(docs);
    }

    public async Task<string> GetEventsAsync(string? userId, string? eventType, int limit)
    {
        var filters = new List<FilterDefinition<BsonDocument>>();

        if (!string.IsNullOrEmpty(userId))
            filters.Add(Builders<BsonDocument>.Filter.Eq("user_id", userId));

        if (!string.IsNullOrEmpty(eventType))
            filters.Add(Builders<BsonDocument>.Filter.Eq("event_type", eventType));

        var filter = filters.Count > 0
            ? Builders<BsonDocument>.Filter.And(filters)
            : FilterDefinition<BsonDocument>.Empty;

        var docs = await _events
            .Find(filter)
            .Project(ExcludeId)
            .Sort(Builders<BsonDocument>.Sort.Descending("timestamp"))
            .Limit(limit)
            .ToListAsync();

        return ToJsonArray(docs);
    }

    private static string ToJsonArray(List<BsonDocument> docs)
    {
        if (docs.Count == 0) return "[]";
        return "[" + string.Join(",", docs.Select(d => d.ToJson(RelaxedJson))) + "]";
    }
}
