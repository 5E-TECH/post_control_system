import React, { useEffect, useState } from "react";
import Highcharts from "highcharts/highmaps";
import HighchartsReact from "highcharts-react-official";

const UzbekistanMap: React.FC = () => {
  const [mapOptions, setMapOptions] = useState<any>(null);

  useEffect(() => {
    const loadMap = async () => {
      // 1. Fetch Uzbekistan topology
      const topology = await fetch(
        "https://code.highcharts.com/mapdata/countries/uz/uz-all.topo.json"
      ).then((response) => response.json());

      // 2. Dummy data
      const data = [
        { "hc-key": "uz-an", value: 350 }, // Andijon
        { "hc-key": "uz-ng", value: 120 }, // Namangan
        { "hc-key": "uz-su", value: 80 }, // Surxondaryo
        { "hc-key": "uz-ta", value: 400 }, // Toshkent viloyati
        { "hc-key": "uz-tk", value: 500 }, // Toshkent shahri
        { "hc-key": "uz-qr", value: 60 }, // Qoraqalpog'iston
        { "hc-key": "uz-bu", value: 95 }, // Buxoro
        { "hc-key": "uz-fa", value: 300 }, // Farg'ona
        { "hc-key": "uz-qa", value: 150 }, // Qashqadaryo
        { "hc-key": "uz-nw", value: 50 }, // Navoiy
        { "hc-key": "uz-ji", value: 200 }, // Jizzax
        { "hc-key": "uz-si", value: 100 }, // Sirdaryo
        { "hc-key": "uz-sa", value: 180 }, // Samarqand
        { "hc-key": "uz-kh", value: 140 }, // Xorazm
      ];

      // 3. Options
      setMapOptions({
        chart: {
          map: topology,
          panning: false,
          zooming: false,
        },
        title: {
          text: "Population Density in Uzbekistan (people per km²)",
        },
        exporting: {
          sourceWidth: 600,
          sourceHeight: 500,
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
        mapNavigation: {
          enabled: false,
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
            data: data,
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
    };

    loadMap();
  }, []);

  if (!mapOptions) return <p>Loading map...</p>;

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
