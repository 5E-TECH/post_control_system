import { memo, type FC } from 'react';

interface RegionMapProps {
  regionName: string | null; // masalan "Namangan"
}

const RegionMap:FC<RegionMapProps> = ({regionName}) => {
    console.log(regionName);
    
  return (
    <div>
      <h2>RegionMap</h2>
    </div>
  );
};

export default memo(RegionMap);



// import { useEffect, useState } from "react";
// import Highcharts from "highcharts";
// import HighchartsReact from "highcharts-react-official";
// // import mapInit from "highcharts/modules/map.js";

// // Highcharts map modulini faollashtiramiz
// // mapInit(Highcharts);

// interface RegionMapProps {
//   regionName: string | null; // masalan "Namangan"
// }

// export default function RegionMap({ regionName }: RegionMapProps) {
//   const [topology, setTopology] = useState<any>(null);
//   const [districts, setDistricts] = useState<any[]>([]);

//   useEffect(() => {
//     // Tumanlar darajasidagi O‘zbekiston JSON faylini yuklaymiz
//     fetch("/maps/gadm_uzb_districts.json")
//       .then((res) => res.json())
//       .then((data) => {
//         setTopology(data);

//         // faqat kerakli viloyat tumanlarini tanlaymiz
//         const filtered = data.features.filter(
//           (f: any) => f.properties.NAME_1 === regionName
//         );

//         // Har bir tumanga random qiymat (bo‘yash uchun)
//         const regionData = filtered.map((f: any) => ({
//           "hc-key": f.properties.GID_2,
//           value: Math.floor(Math.random() * 100),
//           name: f.properties.NAME_2,
//         }));

//         setDistricts(regionData);
//       });
//   }, [regionName]);

//   if (!topology || !districts.length) return <div>Yuklanmoqda...</div>;

//   const options: Highcharts.Options = {
//     chart: {
//       map: topology,
//       backgroundColor: "transparent",
//     },
//     title: {
//       text: `${regionName} viloyati tumanlari`,
//       style: {
//         fontSize: "18px",
//         fontWeight: "bold",
//       },
//     },
//     mapNavigation: {
//       enabled: true,
//       buttonOptions: {
//         verticalAlign: "bottom",
//       },
//     },
//     colorAxis: {
//       min: 0,
//       stops: [
//         [0, "#e0f7fa"],
//         [0.5, "#26c6da"],
//         [1, "#006064"],
//       ],
//     },
//     series: [
//       {
//         type: "map",
//         data: districts,
//         name: "Tumanlar",
//         joinBy: ["GID_2", "hc-key"],
//         states: {
//           hover: {
//             color: "#ffcc00",
//           },
//         },
//         dataLabels: {
//           enabled: true,
//           format: "{point.name}",
//           style: {
//             fontSize: "10px",
//             textOutline: "none",
//           },
//         },
//         tooltip: {
//           pointFormat: "<b>{point.name}</b><br/>Qiymat: {point.value}",
//         },
//       },
//     ],
//   };

//   return (
//     <HighchartsReact
//       highcharts={Highcharts}
//       constructorType="mapChart"
//       options={options}
//     />
//   );
// }
