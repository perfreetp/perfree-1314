import * as turf from "@turf/turf";

const turfAny = turf as any;

export function createLineString(coordinates: number[][], srid: number = 4326) {
  return {
    type: "LineString",
    coordinates,
    srid,
  };
}

export function createPoint(coordinates: number[], srid: number = 4326) {
  return {
    type: "Point",
    coordinates,
    srid,
  };
}

export function createPolygon(coordinates: number[][][], srid: number = 4326) {
  return {
    type: "Polygon",
    coordinates,
    srid,
  };
}

export function parseGeometry(geometry: any): any {
  if (!geometry) return null;
  if (typeof geometry === "string") {
    try {
      return JSON.parse(geometry);
    } catch {
      return geometry;
    }
  }
  return geometry;
}

export function calculateDistance(point1: number[], point2: number[]): number {
  const from = turf.point(point1);
  const to = turf.point(point2);
  return turf.distance(from, to, { units: "meters" });
}

export function calculateLineLength(coordinates: number[][]): number {
  if (coordinates.length < 2) return 0;
  const line = turf.lineString(coordinates);
  return turf.length(line, { units: "meters" });
}

export function pointToLineDistance(point: number[], lineCoordinates: number[][]): number {
  const pt = turf.point(point);
  const line = turf.lineString(lineCoordinates);
  return turf.pointToLineDistance(pt, line, { units: "meters" });
}

export function intersects(geom1: any, geom2: any): boolean {
  try {
    const g1 = parseGeometry(geom1);
    const g2 = parseGeometry(geom2);
    if (!g1 || !g2) return false;
    return turfAny.booleanIntersects(g1, g2);
  } catch {
    return false;
  }
}

export function getIntersection(geom1: any, geom2: any): any {
  try {
    const g1 = parseGeometry(geom1);
    const g2 = parseGeometry(geom2);
    if (!g1 || !g2) return null;
    return turfAny.intersect(g1, g2);
  } catch {
    return null;
  }
}

export function lineIntersectsPolygon(lineCoords: number[][], polygonCoords: number[][][]): boolean {
  try {
    const line = turf.lineString(lineCoords);
    const polygon = turf.polygon(polygonCoords);
    return turfAny.booleanIntersects(line, polygon);
  } catch {
    return false;
  }
}

export function pointInPolygon(pointCoords: number[], polygonCoords: number[][][]): boolean {
  try {
    const point = turf.point(pointCoords);
    const polygon = turf.polygon(polygonCoords);
    return turf.booleanPointInPolygon(point, polygon);
  } catch {
    return false;
  }
}

export function bufferGeometry(geometry: any, distance: number, units: string = "meters"): any {
  try {
    const geom = parseGeometry(geometry);
    if (!geom) return null;
    return turfAny.buffer(geom, distance, { units });
  } catch {
    return null;
  }
}

export function calculateArea(coordinates: number[][][]): number {
  try {
    const polygon = turf.polygon(coordinates);
    return turf.area(polygon);
  } catch {
    return 0;
  }
}

export function getCenter(geometry: any): number[] | null {
  try {
    const geom = parseGeometry(geometry);
    if (!geom) return null;
    const center = turf.center(geom as any);
    return center.geometry.coordinates;
  } catch {
    return null;
  }
}

export function nearestPointOnLine(lineCoords: number[][], pointCoords: number[]): {
  point: number[];
  index: number;
  dist: number;
  location: number;
} {
  try {
    const line = turf.lineString(lineCoords);
    const point = turf.point(pointCoords);
    const nearest = turf.nearestPointOnLine(line, point, { units: "meters" });
    return {
      point: nearest.geometry.coordinates,
      index: nearest.properties.index as number,
      dist: nearest.properties.dist as number,
      location: nearest.properties.location as number,
    };
  } catch {
    return { point: pointCoords, index: 0, dist: 0, location: 0 };
  }
}
