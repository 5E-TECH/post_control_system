import React, { useEffect, useState } from "react";
import Highcharts from "highcharts/highmaps";
import HighchartsReact from "highcharts-react-official";

const UzbekistanMap: React.FC = () => {
  const [mapOptions, setMapOptions] = useState<any>(null);

  useEffect(() => {
    const loadMap = async () => {
      const topology = await fetch(
        "https://code.highcharts.com/mapdata/countries/uz/uz-all.topo.json"
      ).then((response) => response.json());

      const data = [
        { "hc-key": "uz-an", value: 350 },
        { "hc-key": "uz-ng", value: 120 },
        { "hc-key": "uz-su", value: 80 },
        { "hc-key": "uz-ta", value: 400 },
        { "hc-key": "uz-tk", value: 500 },
        { "hc-key": "uz-qr", value: 60 },
        { "hc-key": "uz-bu", value: 95 },
        { "hc-key": "uz-fa", value: 300 },
        { "hc-key": "uz-qa", value: 150 },
        { "hc-key": "uz-nw", value: 50 },
        { "hc-key": "uz-ji", value: 200 },
        { "hc-key": "uz-si", value: 100 },
        { "hc-key": "uz-sa", value: 180 },
        { "hc-key": "uz-kh", value: 140 },
      ];

      setTimeout(() => {
        setMapOptions({
          chart: {
            map: topology,
            panning: false,
            zooming: false,
          },
          title: {
            text: "Population Density in Uzbekistan (people per km²)",
          },
          legend: {
            layout: "horizontal",
            borderWidth: 0,
            backgroundColor:
              "color-mix(in srgb, var(--highcharts-background-color, white), transparent 15%)",
            floating: true,
            verticalAlign: "top",
            y: 25,
          },
          colorAxis: {
            min: 10,
            type: "logarithmic",
            minColor: "#EEEEFF",
            maxColor: "#000022",
            stops: [
              [0, "#EFEFFF"],
              [0.67, "#4444FF"],
              [1, "#000022"],
            ],
          },
          series: [
            {
              name: "Population density",
              data,
              joinBy: "hc-key",
              dataLabels: {
                enabled: true,
                color: "#FFFFFF",
                format: "{point.name}",
              },
              tooltip: {
                pointFormat: "{point.name}: {point.value}/km²",
              },
            },
          ],
        });
      }, 1500); // skeleton uchun kichik kechikish
    };

    loadMap();
  }, []);

  // 🩶 Skeleton loading – xarita shaklidagi gradientli placeholder
  if (!mapOptions)
    return (
      <div className="relative w-full  h-[1500px] flex items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#e5e7eb] via-[#d1d5db] to-[#e5e7eb] animate-pulse">
        <div className="absolute inset-0 left-55 opacity-40 bg-[url('https://code.highcharts.com/mapdata/countries/uz/uz-all.svg')] bg-contain bg-center bg-no-repeat" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shine_1.6s_infinite]" />
      </div>
    );

  return (
    <div className="w-full">
      <HighchartsReact
    
    
        highcharts={Highcharts}
        constructorType={"mapChart"}
        options={{
          ...mapOptions,
          chart: {
            ...(mapOptions?.chart || {}),
            height: "49%",
          },
        }}
      />
    </div>
  );
};

export default UzbekistanMap;
