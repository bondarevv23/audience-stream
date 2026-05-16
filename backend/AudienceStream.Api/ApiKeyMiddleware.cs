namespace AudienceStream.Api;

public class ApiKeyMiddleware(RequestDelegate next, IConfiguration configuration)
{
    private const string ApiKeyHeader = "X-Api-Key";
    private readonly string _apiKey = configuration["Auth:ApiKey"]
        ?? throw new InvalidOperationException("Auth:ApiKey is not configured.");

    public async Task InvokeAsync(HttpContext context)
    {
        if (!context.Request.Headers.TryGetValue(ApiKeyHeader, out var provided)
            || provided != _apiKey)
        {
            Console.WriteLine($"Unauthorized access attempt. Provided key: {provided}, expected key: {_apiKey}");
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsync("Unauthorized");
            return;
        }

        await next(context);
    }
}
