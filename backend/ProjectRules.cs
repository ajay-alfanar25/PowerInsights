using System.Globalization;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
namespace PowerInsights;
public static class ProjectRules {
    static string Text(JsonNode? n)=> n?.ToString()?.Trim() ?? "";
    static decimal? Num(JsonNode? n)=>n is null?null:n.GetValue<decimal>();
    public static void Validate(JsonObject p) {
        if(string.IsNullOrWhiteSpace(Text(p["name"])))throw new ArgumentException("Project name is required.");
        var hv=Text(p["technology_category"])=="HVDC";
        var statuses=hv?new[]{"In Operation","Under Installation","Awarded","Tendering","Planned / Announced"}:new[]{"Awarded","Delivered","Planned","Tendering","Planned / Announced"};
        if(!statuses.Contains(Text(p["status"])))throw new ArgumentException("Choose a valid project status.");
        foreach(var field in new[]{"recorded_cost_usd","equivalent_mvar"})if(Num(p[field]) is decimal n && (n<0 || n>1_000_000_000_000m))throw new ArgumentException(field+" must be a non-negative number.");
        foreach(var field in new[]{"specs","specs_extra","components"}) {
            if(p[field] is not JsonObject obj)throw new ArgumentException(field+" must contain named fields.");
            foreach(var pair in obj)if(pair.Value is not null){if(pair.Value is not JsonValue)throw new ArgumentException("Spec values must be text or numbers.");var text=Text(pair.Value);if(text.Length>20000)throw new ArgumentException("A field exceeds 20,000 characters.");}
        }
        if(p["locations"] is not JsonArray || p["source_ids"] is not JsonArray || p["specs_sources"] is not JsonObject)throw new ArgumentException("Locations, sources or source mappings have an invalid structure.");
        foreach(var loc in p["locations"]!.AsArray()) {
            if(loc is not JsonObject || loc["name"] is null)throw new ArgumentException("Each location requires a name.");
            if(Num(loc["lat"]) is decimal lat && (lat< -90 || lat>90))throw new ArgumentException("Latitude must be between -90 and 90.");
            if(Num(loc["lon"]) is decimal lon && (lon< -180 || lon>180))throw new ArgumentException("Longitude must be between -180 and 180.");
        }
    }
    public static void Apply(JsonObject p,JsonObject old) {
        var s=p["specs"]!.AsObject(); var before=old["specs"]!.AsObject();
        // A changed value is no longer attributed to its old source automatically.
        foreach(var (key,specValue) in s)if(!JsonNode.DeepEquals(specValue,before[key]) && JsonNode.DeepEquals(p["specs_sources"]?[key],old["specs_sources"]?[key]))p["specs_sources"]![key]=new JsonArray();
        if(!JsonNode.DeepEquals(p["award_date"],old["award_date"])) {
            var year=Regex.Match(Text(p["award_date"]),@"\b(20\d{2})\b");
            if(JsonNode.DeepEquals(s["analysis_year"],before["analysis_year"]))s["analysis_year"]=year.Success?year.Groups[1].Value:"Not available";
            if(JsonNode.DeepEquals(s["commissioning_date"],before["commissioning_date"]))s["commissioning_date"]=Text(p["award_date"]);
        }
        p["stage_override"]=Text(p["status"]);p["maturity"]=Text(p["status"]);
        if(!JsonNode.DeepEquals(p["status"],old["status"])) {p["status_detail"]=Text(p["status"]);p["status_source_ids"]=new JsonArray();p["status_checked"]=DateTime.UtcNow.ToString("yyyy-MM-dd");}
        if(Text(p["technology_category"])=="HVDC") {
            if(!JsonNode.DeepEquals(s["capacity_mw"],before["capacity_mw"]) && JsonNode.DeepEquals(s["analysis_capacity_mw"],before["analysis_capacity_mw"]))s["analysis_capacity_mw"]=decimal.TryParse(Text(s["capacity_mw"]),NumberStyles.Number,CultureInfo.InvariantCulture,out var mw)?mw.ToString(CultureInfo.InvariantCulture):"Not available";
            p["capacity"]=$"{Text(s["capacity_mw"])} MW; {Text(s["dc_voltage_kv"])} kV DC; {Text(s["converter_technology"])}";
            return;
        }
        var changedRating=!JsonNode.DeepEquals(s["rating_mvar"],before["rating_mvar"])||!JsonNode.DeepEquals(s["number_of_units"],before["number_of_units"]);
        if(changedRating && JsonNode.DeepEquals(p["equivalent_mvar"],old["equivalent_mvar"]))p["equivalent_mvar"]=Equivalent(Text(s["rating_mvar"]),Text(s["number_of_units"]));
        p["capacity"]=Text(s["rating_mvar"])+" MVAr; "+Text(s["connection_voltage_kv"])+" kV bus";
        if(changedRating && p["specs_scope"] is JsonArray scope)for(var i=0;i<scope.Count;i++)if(Text(scope[i]).StartsWith("STATCOM / reactive compensation:"))scope[i]="STATCOM / reactive compensation: "+Text(s["rating_mvar"])+" MVAr";
        var eq=Num(p["equivalent_mvar"]);var actual=Num(p["recorded_cost_usd"]);decimal? value=actual;var estimated=false;var basis=actual is null?"Not available":"Recorded project cost (USD)";
        var type=Text(s["project_type"]);var id=Text(p["id"]);var v=Regex.Match(Text(s["connection_voltage_kv"]),@"^\s*(\d+(?:\.\d+)?)\s*(?:kV)?\s*$",RegexOptions.IgnoreCase);
        decimal? voltage=v.Success?decimal.Parse(v.Groups[1].Value,CultureInfo.InvariantCulture):null;
        if(actual is null && Regex.IsMatch(id,@"^STATCOM-(45|46|47|48|49|50|51|52)$") && type.Contains("E-STATCOM",StringComparison.OrdinalIgnoreCase)){value=8_000_000m;estimated=true;basis="USD 64,000,000 package allocated equally across eight E-STATCOM projects";}
        else if(actual is null && eq>0 && voltage is not null) {
            var svc=Text(p["variant"])=="SVC";decimal? rate=null;
            if(!svc)rate=voltage switch {13.8m=>5_333_333.333333333m/20m,132m=>37_573_333m/600m,33m=>Regex.IsMatch(id,@"^STATCOM-(3[3-9]|4[0-4])$")?9_333_333.333333333m/120m:36_990_827m/600m,_=>null};
            else rate=voltage switch {110m=>51_700_000m/450m,380m=>123_000_000m/1800m,_=>null};
            if(rate is not null){value=eq*rate;estimated=true;basis=$"{eq.Value.ToString("0.####",CultureInfo.InvariantCulture)} equivalent MVAr × USD {rate.Value.ToString("N2",CultureInfo.InvariantCulture)}/MVAr at {voltage} kV; estimated cost";}
        }
        p["cost_value_usd"]=value;p["cost_estimated"]=estimated;p["cost_basis"]=basis;
        var display=value is null?"Not available":"USD "+value.Value.ToString("N2",CultureInfo.InvariantCulture)+(estimated?" (estimated cost)":"");
        s["cost"]=display;p["total_value"]=display;p["specs_extra"]!["Cost estimation basis"]=basis;
    }
    public static decimal? Equivalent(string rating,string units) {
        var text=rating.Replace('×','x').Replace('−','-').Trim();
        if(Regex.IsMatch(text,@"unclear|ambiguous|not available|combined|per mobile",RegexOptions.IgnoreCase))return null;
        decimal count=1;var prefix=Regex.Match(text,@"^(\d+)\s*x\s*",RegexOptions.IgnoreCase);
        if(prefix.Success){count=decimal.Parse(prefix.Groups[1].Value);text=text[prefix.Length..].Trim(' ','(',')');}
        else if(decimal.TryParse(units,NumberStyles.Number,CultureInfo.InvariantCulture,out var n)&&n>0)count=n;
        else {var sites=Regex.Match(text,@"\((\d+) sites\)");if(sites.Success)count=decimal.Parse(sites.Groups[1].Value);else if(text.Contains("per ",StringComparison.OrdinalIgnoreCase))return null;}
        var pm=Regex.Match(text,@"^±\s*(\d+(?:\.\d+)?)");if(pm.Success)return count*2*decimal.Parse(pm.Groups[1].Value,CultureInfo.InvariantCulture);
        var signed=Regex.Match(text,@"^([+-]\d+(?:\.\d+)?)\s*[/,]\s*([+-]\d+(?:\.\d+)?)");
        if(signed.Success)return count*(Math.Abs(decimal.Parse(signed.Groups[1].Value,CultureInfo.InvariantCulture))+Math.Abs(decimal.Parse(signed.Groups[2].Value,CultureInfo.InvariantCulture)));
        var single=Regex.Match(text,@"^\+?(\d+(?:\.\d+)?)(?:\s|$)");return single.Success?count*decimal.Parse(single.Groups[1].Value,CultureInfo.InvariantCulture):null;
    }
}
