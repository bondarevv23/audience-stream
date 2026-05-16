FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY AudienceStream.Api/AudienceStream.Api.csproj AudienceStream.Api/
RUN dotnet restore AudienceStream.Api/AudienceStream.Api.csproj
COPY AudienceStream.Api/ AudienceStream.Api/
RUN dotnet publish AudienceStream.Api/AudienceStream.Api.csproj \
    -c Release \
    -o /app/publish \
    --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8081
ENTRYPOINT ["dotnet", "AudienceStream.Api.dll"]
