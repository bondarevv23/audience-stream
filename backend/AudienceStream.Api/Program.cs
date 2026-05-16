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
builder.Services.AddSingleton<GeminiService>();
builder.Services.AddHttpClient();

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

app.MapGet("/admin/events/recent", async (int? limit, EventService eventService) =>
{
    var json = await eventService.GetRecentEventsAsync(limit is > 0 ? limit.Value : 50);
    return Results.Content(json, "application/json");
});

app.MapPost("/admin/events/by-type", async (HttpRequest request, EventService eventService) =>
{
    using var body = await JsonDocument.ParseAsync(request.Body);
    var root = body.RootElement;

    var eventType = root.TryGetProperty("eventType", out var et) ? et.GetString() : null;
    var limit = root.TryGetProperty("limit", out var lim) && lim.TryGetInt32(out var l) ? l : 50;

    if (string.IsNullOrEmpty(eventType))
        return Results.BadRequest(new { error = "eventType is required." });

    var json = await eventService.GetEventsByTypeAsync(eventType, limit);
    return Results.Content(json, "application/json");
});

app.MapPost("/admin/events", async (HttpRequest request, EventService eventService) =>
{
    using var body = await JsonDocument.ParseAsync(request.Body);
    var root = body.RootElement;

    var userId = root.TryGetProperty("user_id", out var uid) ? uid.GetString() : null;
    var eventType = root.TryGetProperty("event_type", out var et) ? et.GetString() : null;
    var limit = root.TryGetProperty("limit", out var lim) && lim.TryGetInt32(out var l) ? l : 50;

    var json = await eventService.GetEventsAsync(userId, eventType, limit);
    return Results.Content(json, "application/json");
});

app.MapPost("/admin/gemini-query", async (HttpRequest request, EventService eventService, GeminiService geminiService) =>
{
    using var body = await JsonDocument.ParseAsync(request.Body);
    var question = body.RootElement.TryGetProperty("question", out var q) ? q.GetString() : null;

    if (string.IsNullOrWhiteSpace(question))
        return Results.BadRequest(new { error = "question is required." });

    var eventsJson = await eventService.GetAllEventsJsonAsync();

    try
    {
        var result = await geminiService.QueryAsync(question, eventsJson);
        return Results.Ok(result);
    }
    catch (HttpRequestException ex)
    {
        return Results.Problem(
            detail: ex.Message,
            title: "Gemini API request failed.",
            statusCode: 502);
    }
});

var eventService = app.Services.GetRequiredService<EventService>();
await eventService.EnsureIndexesAsync();

app.Run();