using Microsoft.Data.Sqlite;
using System.Text.Json.Nodes;

namespace PowerInsights;
public sealed class RevisionConflictException : Exception { }
public sealed class ProjectStore {
    readonly string connectionString;
    readonly string seedPath;
    public ProjectStore(IConfiguration config, IWebHostEnvironment env) {
        var file = Path.GetFullPath(config["DatabasePath"] ?? Path.Combine(env.ContentRootPath, "App_Data", "powerinsights.db"));
        Directory.CreateDirectory(Path.GetDirectoryName(file)!);
        connectionString = new SqliteConnectionStringBuilder { DataSource = file, DefaultTimeout = 15 }.ToString();
        seedPath = Path.Combine(env.ContentRootPath, "Data", "seed.json");
    }
    SqliteConnection Open() { var c = new SqliteConnection(connectionString); c.Open(); return c; }
    static SqliteCommand Command(SqliteConnection c, string sql, SqliteTransaction? tx = null, params (string, object?)[] args) {
        var cmd = c.CreateCommand(); cmd.CommandText = sql; cmd.Transaction = tx;
        foreach (var (key, val) in args) cmd.Parameters.AddWithValue(key, val ?? DBNull.Value); return cmd;
    }
    public void Initialize() {
        using var c = Open();
        using(var cmd = Command(c, "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY, document TEXT NOT NULL CHECK(json_valid(document)), revision INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS metadata(id INTEGER PRIMARY KEY CHECK(id=1), document TEXT NOT NULL); CREATE TABLE IF NOT EXISTS history(id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL, revision INTEGER NOT NULL, changed_at TEXT NOT NULL, before_json TEXT NOT NULL, after_json TEXT NOT NULL);")) cmd.ExecuteNonQuery();
        using var tx = c.BeginTransaction();
        using var count = Command(c, "SELECT count(*) FROM metadata", tx);
        if (Convert.ToInt32(count.ExecuteScalar()) == 0) {
            var seed = JsonNode.Parse(File.ReadAllText(seedPath))!.AsObject();
            foreach(var p in seed["projects"]!.AsArray()) {
                using var insert=Command(c,"INSERT INTO projects VALUES($id,$doc,1)",tx,("$id",p!["id"]!.GetValue<string>()),("$doc",p.ToJsonString()));insert.ExecuteNonQuery();
            }
            seed.Remove("projects");
            using var meta=Command(c,"INSERT INTO metadata VALUES(1,$doc)",tx,("$doc",seed.ToJsonString()));meta.ExecuteNonQuery();
        }
        tx.Commit();
    }
    public JsonObject ReadData() {
        using var c=Open(); using var tx=c.BeginTransaction();
        using var meta=Command(c,"SELECT document FROM metadata WHERE id=1",tx);
        var data=JsonNode.Parse((string)meta.ExecuteScalar()!)!.AsObject();var rows=new JsonArray();
        using(var query=Command(c,"SELECT document FROM projects ORDER BY rowid",tx))using(var reader=query.ExecuteReader())while(reader.Read())rows.Add(JsonNode.Parse(reader.GetString(0)));
        data["projects"]=rows;tx.Commit();return data;
    }
    public JsonObject? Get(string id) {using var c=Open();using var q=Command(c,"SELECT document FROM projects WHERE id=$id",null,("$id",id));return q.ExecuteScalar() is string s?JsonNode.Parse(s)!.AsObject():null;}
    public JsonArray History(string id) {using var c=Open();using var q=Command(c,"SELECT revision,changed_at FROM history WHERE project_id=$id ORDER BY revision DESC LIMIT 50",null,("$id",id));using var r=q.ExecuteReader();var rows=new JsonArray();while(r.Read())rows.Add(new JsonObject{["revision"]=r.GetInt32(0),["changedAt"]=r.GetString(1)});return rows;}
    public JsonObject Create(JsonObject incoming) {
        if(incoming.ToJsonString().Length>150000)throw new ArgumentException("Project is too large.");
        var technology=incoming["technology_category"]?.ToString()?.Trim();
        if(technology is not ("HVDC" or "STATCOM"))throw new ArgumentException("Choose HVDC or STATCOM technology.");
        var p=new JsonObject {
            ["technology_category"]=technology,["variant"]=technology,["aliases"]=new JsonArray(),["package_ids"]=new JsonArray(),
            ["specs_not_found"]=new JsonArray(),["status_source_ids"]=new JsonArray(),["related_ids"]=new JsonArray()
        };
        string[] editable=["name","owner","award_date","completion_target","status","confidence","notes","specs","specs_extra","components","locations","source_ids","specs_sources","specs_scope","recorded_cost_usd","equivalent_mvar"];
        foreach(var key in editable)p[key]=incoming[key]?.DeepClone();
        p["name"]??="";p["owner"]??="";p["award_date"]??="";p["completion_target"]??="";p["confidence"]??="Medium";p["notes"]??="";
        p["specs"]??=new JsonObject();p["specs_extra"]??=new JsonObject();p["components"]??=new JsonObject();p["locations"]??=new JsonArray();
        p["source_ids"]??=new JsonArray();p["specs_sources"]??=new JsonObject();p["specs_scope"]??=new JsonArray();
        ProjectRules.Validate(p);
        using var c=Open();using var tx=c.BeginTransaction();
        var prefix=technology+"-";var next=1;
        using(var ids=Command(c,"SELECT id FROM projects WHERE id LIKE $prefix",tx,("$prefix",prefix+"%")))using(var reader=ids.ExecuteReader())while(reader.Read()) {
            var id=reader.GetString(0);var suffix=id[prefix.Length..];if(int.TryParse(suffix,out var number))next=Math.Max(next,number+1);
        }
        p["id"]=prefix+next.ToString("D2");
        var old=p.DeepClone().AsObject();old["status"]="";old["award_date"]="";old["equivalent_mvar"]=null;old["recorded_cost_usd"]=null;
        var oldSpecs=old["specs"]!.AsObject();oldSpecs["capacity_mw"]=null;oldSpecs["rating_mvar"]=null;oldSpecs["number_of_units"]=null;
        ProjectRules.Apply(p,old);
        p["revision"]=1;p["created_at"]=DateTimeOffset.UtcNow.ToString("O");p["updated_at"]=p["created_at"]!.DeepClone();
        using(var insert=Command(c,"INSERT INTO projects(id,document,revision) VALUES($id,$doc,1)",tx,("$id",p["id"]!.ToString()),("$doc",p.ToJsonString())))insert.ExecuteNonQuery();
        tx.Commit();return p;
    }
    public JsonObject Update(string id, JsonObject incoming) {
        if(incoming.ToJsonString().Length>150000)throw new ArgumentException("Project is too large.");
        using var c=Open();using var tx=c.BeginTransaction();
        using var q=Command(c,"SELECT document, revision FROM projects WHERE id=$id",tx,("$id",id));
        string previous;int revision;
        using(var r=q.ExecuteReader()){if(!r.Read())throw new KeyNotFoundException();previous=r.GetString(0);revision=r.GetInt32(1);}
        var old=JsonNode.Parse(previous)!.AsObject();
        if(incoming["revision"]?.GetValue<int>()!=revision)throw new RevisionConflictException();
        var p=old.DeepClone().AsObject();
        string[] editable=["name","owner","award_date","completion_target","status","confidence","notes","specs","specs_extra","components","locations","source_ids","specs_sources","specs_scope","recorded_cost_usd","equivalent_mvar"];
        foreach(var key in editable)if(incoming.ContainsKey(key))p[key]=incoming[key]?.DeepClone();
        ProjectRules.Validate(p);
        ProjectRules.Apply(p,old);
        p["revision"]=revision+1;p["updated_at"]=DateTimeOffset.UtcNow.ToString("O");
        using(var update=Command(c,"UPDATE projects SET document=$doc,revision=$revision WHERE id=$id AND revision=$old",tx,("$doc",p.ToJsonString()),("$revision",revision+1),("$id",id),("$old",revision))){if(update.ExecuteNonQuery()!=1)throw new RevisionConflictException();}
        using(var log=Command(c,"INSERT INTO history(project_id,revision,changed_at,before_json,after_json) VALUES($id,$rev,$at,$before,$after)",tx,("$id",id),("$rev",revision+1),("$at",p["updated_at"]!.GetValue<string>()),("$before",previous),("$after",p.ToJsonString())))log.ExecuteNonQuery();
        tx.Commit();return p;
    }
}
