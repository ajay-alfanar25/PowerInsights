using System.Text.Json.Nodes;
using Microsoft.Data.Sqlite;
using PowerInsights;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddSingleton<ProjectStore>();
var app = builder.Build();
app.Services.GetRequiredService<ProjectStore>().Initialize();
app.Use(async (context, next) => {
    if (context.Request.Path.StartsWithSegments("/api")) {
        context.Response.Headers.CacheControl = "no-store";
        // Same-origin JSON writes: reject cross-site browser requests.
        if ((HttpMethods.IsPut(context.Request.Method) || HttpMethods.IsPost(context.Request.Method)) && context.Request.Headers["Sec-Fetch-Site"] == "cross-site") {
            context.Response.StatusCode = 403; return;
        }
    }
    await next();
});
app.UseDefaultFiles(); app.UseStaticFiles();
app.MapGet("/api/health", () => Results.Ok(new { status = "ok", app = "PowerInsights" }));
app.MapGet("/api/data", (ProjectStore store) => Results.Json(store.ReadData()));
app.MapGet("/api/projects/{id}", (string id, ProjectStore store) => store.Get(id) is {} p ? Results.Json(p) : Results.NotFound());
app.MapGet("/api/projects/{id}/history", (string id, ProjectStore store) => Results.Json(store.History(id)));
app.MapPost("/api/projects", (JsonObject project, ProjectStore store) => {
    try { return Results.Json(store.Create(project)); }
    catch (ArgumentException e) { return Results.BadRequest(new { message = e.Message }); }
    catch (InvalidOperationException) { return Results.BadRequest(new { message = "Invalid field format. Check numeric fields, lists and specification values." }); }
    catch (FormatException) { return Results.BadRequest(new { message = "Invalid numeric field." }); }
});
app.MapPut("/api/projects/{id}", (string id, JsonObject project, ProjectStore store) => {
    try { return Results.Json(store.Update(id, project)); }
    catch (KeyNotFoundException) { return Results.NotFound(); }
    catch (RevisionConflictException) { return Results.Conflict(new { message = "This project changed since you opened it. Close the editor, refresh, and reopen it before saving." }); }
    catch (ArgumentException e) { return Results.BadRequest(new { message = e.Message }); }
    catch (InvalidOperationException) { return Results.BadRequest(new { message = "Invalid field format. Check numeric fields, lists and specification values." }); }
    catch (FormatException) { return Results.BadRequest(new { message = "Invalid numeric field." }); }
});
app.Map("/api/{**path}", () => Results.NotFound());
app.MapFallbackToFile("index.html");
app.Run();
