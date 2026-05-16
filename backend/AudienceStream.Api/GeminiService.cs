using System.Net.Http.Json;
using System.Text.Json;

namespace AudienceStream.Api;

public record GeminiQueryResult(string Summary, List<string> MatchedUsers);

public class GeminiService(IHttpClientFactory httpClientFactory, IConfiguration configuration)
{
    private readonly string _apiKey = configuration["Gemini:ApiKey"]
        ?? throw new InvalidOperationException("Gemini:ApiKey is not configured.");

    private const string Model = "gemini-2.0-flash";
    private const string ApiBase = "https://generativelanguage.googleapis.com/v1beta/models";

    public async Task<GeminiQueryResult> QueryAsync(string question, string eventsJson)
    {
        var prompt = $$"""
            You are an analytics assistant for a behavioral audience tracking platform.
            You have access to all tracked user events stored in the system.

            EVENTS DATA (JSON array):
            {{eventsJson}}

            ADMIN QUESTION: {{question}}

            Analyze the events data above and answer the admin's question.
            Respond ONLY with a valid JSON object using exactly this structure:
            {
              "summary": "<concise natural-language answer to the question>",
              "matched_users": ["<user_id>", ...]
            }

            Rules:
            - "summary" must directly answer the question based on the data.
            - "matched_users" must list only user_id values relevant to the answer. Use an empty array if the question is not about specific users.
            """;

        var requestBody = new
        {
            contents = new[]
            {
                new { parts = new[] { new { text = prompt } } }
            },
            generationConfig = new { responseMimeType = "application/json" }
        };

        var client = httpClientFactory.CreateClient();
        var url = $"{ApiBase}/{Model}:generateContent";

        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, url);
        httpRequest.Headers.Add("x-goog-api-key", _apiKey);
        httpRequest.Content = JsonContent.Create(requestBody);
        httpRequest.Content.Headers.ContentType =
            new System.Net.Http.Headers.MediaTypeHeaderValue("application/json");

        var httpResponse = await client.SendAsync(httpRequest);
        httpResponse.EnsureSuccessStatusCode();

        using var doc = await JsonDocument.ParseAsync(
            await httpResponse.Content.ReadAsStreamAsync());

        var text = doc.RootElement
            .GetProperty("candidates")[0]
            .GetProperty("content")
            .GetProperty("parts")[0]
            .GetProperty("text")
            .GetString()!;

        using var result = JsonDocument.Parse(text);
        var root = result.RootElement;

        var summary = root.TryGetProperty("summary", out var s)
            ? s.GetString() ?? ""
            : "";

        var matchedUsers = root.TryGetProperty("matched_users", out var mu)
            ? mu.EnumerateArray()
                .Select(u => u.GetString() ?? "")
                .Where(u => u.Length > 0)
                .ToList()
            : [];

        return new GeminiQueryResult(summary, matchedUsers);
    }
}