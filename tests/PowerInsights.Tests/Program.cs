using System.Text.Json.Nodes;
using Microsoft.Extensions.Configuration;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.FileProviders;
using PowerInsights;

var root=Path.GetFullPath(args.Length>0?args[0]:"backend");
var temp=Path.Combine(Path.GetTempPath(),"powerinsights-test-"+Guid.NewGuid());Directory.CreateDirectory(temp);
var config=new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>{{"DatabasePath",Path.Combine(temp,"test.db")}}).Build();
var env=new TestEnvironment{ContentRootPath=root};var store=new ProjectStore(config,env);store.Initialize();
int checks=0;void Check(bool ok,string message){if(!ok)throw new Exception(message);checks++;Console.WriteLine("PASS "+message);}
var data=store.ReadData();Check(data["projects"]!.AsArray().Count==73,"all 73 HVDC and STATCOM/SVC records imported");
var p=store.Get("STATCOM-40")!;var old=p.DeepClone().AsObject();
p["specs"]!["rating_mvar"]="±10";p["specs"]!["number_of_units"]="1";
p["specs"]!["connection_voltage_kv"]="13.8";p["recorded_cost_usd"]=null;
var saved=store.Update("STATCOM-40",p);Check(Math.Abs(saved["cost_value_usd"]!.GetValue<decimal>()-5_333_333.333333333m)<0.01m,"single ±10 MVAr 13.8 kV costs USD 5.333m");
Check(saved["equivalent_mvar"]!.GetValue<decimal>()==20m,"equivalent MVAr doubles signed range once");
Check(saved["specs"]!["cost"]!.GetValue<string>().Contains("5,333,333.33"),"report cost display agrees with numeric cost");
try{store.Update("STATCOM-40",old);throw new Exception("Conflict not detected");}catch(RevisionConflictException){Check(true,"stale save rejected");}
saved["specs"]!["rating_mvar"]="2 x ±10";saved["specs"]!["number_of_units"]="2";saved=store.Update("STATCOM-40",saved);
Check(saved["equivalent_mvar"]!.GetValue<decimal>()==40m,"explicit prefix and unit count not double counted");
Check(Math.Abs(saved["cost_value_usd"]!.GetValue<decimal>()-10_666_666.666666666m)<0.01m,"two units use corrected 13.8 kV rate");
saved["recorded_cost_usd"]=1234567m;saved=store.Update("STATCOM-40",saved);Check(saved["cost_value_usd"]!.GetValue<decimal>()==1234567m&&!saved["cost_estimated"]!.GetValue<bool>(),"recorded cost takes precedence");
saved["recorded_cost_usd"]=null;saved["specs"]!["connection_voltage_kv"]="115";saved=store.Update("STATCOM-40",saved);Check(saved["cost_value_usd"]is null&&saved["specs"]!["cost"]!.GetValue<string>()=="Not available","unsupported voltage leaves cost unavailable");
saved["specs"]!["connection_voltage_kv"]="13.8";saved["specs"]!["rating_mvar"]="30 (per-unit vs total unclear)";saved=store.Update("STATCOM-40",saved);Check(saved["cost_value_usd"]is null,"ambiguous changed rating leaves estimate unavailable");
var e=store.Get("STATCOM-45")!;e["status"]="Awarded";e=store.Update("STATCOM-45",e);Check(e["cost_value_usd"]!.GetValue<decimal>()==8_000_000,"E-STATCOM package allocation preserved");
var h=store.Get("HVDC-07")!;h["status"]="Under Installation";h["specs"]!["capacity_mw"]="3500";h["specs"]!["epc_contractor"]="Test EPC";h=store.Update("HVDC-07",h);Check(h["stage_override"]!.GetValue<string>()=="Under Installation"&&h["capacity"]!.GetValue<string>().StartsWith("3500"),"HVDC status and capacity synchronize derived fields");
var reopened=new ProjectStore(config,env);reopened.Initialize();Check(reopened.Get("HVDC-07")!["specs"]!["epc_contractor"]!.GetValue<string>()=="Test EPC","data persists after reopening SQLite");Check(reopened.History("HVDC-07").Count==1,"revision history recorded");
var bad=reopened.Get("HVDC-07")!;bad["name"]="";try{reopened.Update("HVDC-07",bad);throw new Exception("Validation missing");}catch(ArgumentException){Check(true,"blank project name rejected");}
Check(ProjectRules.Equivalent("+450 / -150","1")==600,"asymmetric signed rating cost basis");Check(ProjectRules.Equivalent("3 x ±20","3")==120,"NARI reference basis");
var added=reopened.Create(new JsonObject {
    ["technology_category"]="HVDC",["name"]="Test New HVDC Link",["owner"]="Test Utility",["status"]="Planned / Announced",["confidence"]="Medium",
    ["award_date"]="2027",["completion_target"]="2030",["notes"]="Created by automated test",["locations"]=new JsonArray(),["source_ids"]=new JsonArray(),
    ["specs_sources"]=new JsonObject(),["specs_scope"]=new JsonArray(),["components"]=new JsonObject(),["specs_extra"]=new JsonObject(),
    ["specs"]=new JsonObject{{"capacity_mw","2000"},{"dc_voltage_kv","500"},{"converter_technology","VSC"},{"epc_contractor","Test EPC"}}
});
Check(added["id"]!.GetValue<string>()=="HVDC-13"&&added["revision"]!.GetValue<int>()==1,"new project receives the next technology ID");
Check(added["capacity"]!.GetValue<string>().StartsWith("2000 MW"),"new HVDC project derives dashboard capacity");
var afterCreate=new ProjectStore(config,env);afterCreate.Initialize();Check(afterCreate.Get("HVDC-13")!["name"]!.GetValue<string>()=="Test New HVDC Link","new project persists after reopening SQLite");
var addedStatcom=afterCreate.Create(new JsonObject {
    ["technology_category"]="STATCOM",["name"]="Test New STATCOM",["owner"]="Test Utility",["status"]="Planned",["confidence"]="Medium",
    ["award_date"]="2027",["completion_target"]="2030",["notes"]="Created by automated test",["locations"]=new JsonArray(),["source_ids"]=new JsonArray(),
    ["specs_sources"]=new JsonObject(),["specs_scope"]=new JsonArray(),["components"]=new JsonObject(),["specs_extra"]=new JsonObject(),
    ["specs"]=new JsonObject{{"rating_mvar","±10"},{"number_of_units","1"},{"connection_voltage_kv","13.8"},{"project_type","Conventional"}}
});
Check(addedStatcom["id"]!.GetValue<string>()=="STATCOM-60","new STATCOM project receives the next technology ID");
Check(addedStatcom["equivalent_mvar"]!.GetValue<decimal>()==20m&&addedStatcom["cost_value_usd"] is not null,"new STATCOM project derives rating and cost fields");
Console.WriteLine($"{checks} checks passed. Test database: {temp}");
sealed class TestEnvironment:IWebHostEnvironment {
 public string ApplicationName{get;set;}="PowerInsights.Tests";public string EnvironmentName{get;set;}="Development";public string ContentRootPath{get;set;}="";public IFileProvider ContentRootFileProvider{get;set;}=new NullFileProvider();public string WebRootPath{get;set;}="";public IFileProvider WebRootFileProvider{get;set;}=new NullFileProvider();
}
