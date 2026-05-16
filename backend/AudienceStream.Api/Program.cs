using System.Text.Json;
using AudienceStream.Api;
using MongoDB.Bson;
using MongoDB.Driver;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration["MongoDB:ConnectionString"]
    ?? "mongodb://localhost:27017";
var databaseName = builder.Configuration["MongoDB:Database"]
    ?? "audience_stream";

builder.Services.AddSingleton<IMongoClient>(_ => new MongoClient(connectionString));
builder.Services.AddSingleton(sp =>
    sp.GetRequiredService<IMongoClient>().GetDatabase(databaseName));
builder.Services.AddSingleton<EventService>();

var app = builder.Build();

app.UseMiddleware<ApiKeyMiddleware>();

app.MapPost("/api/events", async (HttpRequest request, EventService eventService) =>
{
    using var reader = new StreamReader(request.Body);
    var body = (await reader.ReadToEndAsync()).Trim();

    List<BsonDocument> documents;
    try
    {
        if (body.StartsWith('['))
        {
            var array = JsonSerializer.Deserialize<JsonElement[]>(body)
                ?? throw new JsonException("Empty array.");
            documents = array
                .Select(e => BsonDocument.Parse(e.GetRawText()))
                .ToList();
        }
        else
        {
            documents = [BsonDocument.Parse(body)];
        }
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { error = "Invalid JSON.", detail = ex.Message });
    }

    if (documents.Count == 0)
        return Results.BadRequest(new { error = "No events provided." });

    await eventService.InsertBatchAsync(documents);

    return Results.Ok(new { inserted = documents.Count });
});

var eventService = app.Services.GetRequiredService<EventService>();
await eventService.EnsureIndexesAsync();

app.Run();